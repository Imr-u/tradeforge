from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from app.db.database import get_db
from app.models.models import Trade, Account
from app.deps import get_current_user
from app.models.models import User
from typing import Optional
from datetime import datetime

router = APIRouter()


def _enum_val(v):
    """Safely extract string value from an enum or return the value as-is."""
    return v.value if hasattr(v, 'value') else v


@router.get("/dashboard")
async def get_dashboard(
    account_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    base = select(Trade).join(Account).where(Account.user_id == current_user.id)
    if account_id:
        base = base.where(Trade.account_id == account_id)

    result = await db.execute(base)
    trades = result.scalars().all()

    if not trades:
        return {
            "summary": {
                "total_trades": 0, "net_pnl": 0, "gross_profit": 0,
                "gross_loss": 0, "profit_factor": 0, "win_rate": 0,
                "wins": 0, "losses": 0, "breakeven": 0,
                "avg_win": 0, "avg_loss": 0, "avg_r_multiple": 0,
                "expectancy": 0, "current_streak": 0,
            },
            "forge_score": {"profit": 0, "win": 0, "risk": 0, "discipline": 0, "execution": 0, "resilience": 0},
            "by_kill_zone": {},
            "by_setup": {},
            "cumulative_pnl": [],
        }

    total = len(trades)
    wins      = [t for t in trades if t.pnl and t.pnl > 0]
    losses    = [t for t in trades if t.pnl and t.pnl < 0]
    breakeven = [t for t in trades if t.pnl == 0]

    net_pnl      = sum(t.pnl for t in trades if t.pnl)
    gross_profit = sum(t.pnl for t in wins)
    gross_loss   = abs(sum(t.pnl for t in losses))
    profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else 0

    win_rate  = round(len(wins) / total * 100, 1)
    avg_win   = round(gross_profit / len(wins), 2) if wins else 0
    avg_loss  = round(gross_loss / len(losses), 2) if losses else 0
    r_vals    = [t.r_multiple for t in trades if t.r_multiple is not None]
    avg_r     = round(sum(r_vals) / len(r_vals), 2) if r_vals else 0
    expectancy = round((win_rate / 100 * avg_win) - ((1 - win_rate / 100) * avg_loss), 2)

    # Current win streak
    sorted_trades = sorted(trades, key=lambda t: t.entry_time, reverse=True)
    streak = 0
    for t in sorted_trades:
        if t.pnl and t.pnl > 0:
            streak += 1
        else:
            break

    # By kill zone
    kz_stats = {}
    for t in trades:
        if t.kill_zone is None:
            continue
        kz = _enum_val(t.kill_zone)
        if kz not in kz_stats:
            kz_stats[kz] = {"trades": 0, "wins": 0, "losses": 0, "pnl": 0}
        kz_stats[kz]["trades"] += 1
        if t.pnl and t.pnl > 0:
            kz_stats[kz]["wins"] += 1
        elif t.pnl and t.pnl < 0:
            kz_stats[kz]["losses"] += 1
        kz_stats[kz]["pnl"] += t.pnl or 0

    for kz in kz_stats:
        n = kz_stats[kz]["trades"]
        kz_stats[kz]["win_rate"] = round(kz_stats[kz]["wins"] / n * 100, 1)
        kz_stats[kz]["pnl"]      = round(kz_stats[kz]["pnl"], 2)

    # By setup
    setup_stats = {}
    for t in trades:
        if t.setup is None:
            continue
        s = _enum_val(t.setup)
        if s not in setup_stats:
            setup_stats[s] = {"trades": 0, "wins": 0, "losses": 0, "pnl": 0, "r_total": 0}
        setup_stats[s]["trades"] += 1
        if t.pnl and t.pnl > 0:
            setup_stats[s]["wins"] += 1
        elif t.pnl and t.pnl < 0:
            setup_stats[s]["losses"] += 1
        setup_stats[s]["pnl"]     += t.pnl or 0
        setup_stats[s]["r_total"] += t.r_multiple or 0

    for s in setup_stats:
        n = setup_stats[s]["trades"]
        setup_stats[s]["win_rate"] = round(setup_stats[s]["wins"] / n * 100, 1)
        setup_stats[s]["avg_r"]    = round(setup_stats[s]["r_total"] / n, 2)
        setup_stats[s]["pnl"]      = round(setup_stats[s]["pnl"], 2)

    # Cumulative P&L curve
    sorted_asc = sorted(trades, key=lambda t: t.entry_time)
    cumulative = []
    running = 0
    for t in sorted_asc:
        running += t.pnl or 0
        cumulative.append({
            "date":       t.entry_time.strftime("%Y-%m-%d"),
            "pnl":        round(t.pnl or 0, 2),
            "cumulative": round(running, 2),
        })

    # Forge score
    forge_score = {
        "profit":     min(100, max(0, int((profit_factor - 1) * 50))),
        "win":        int(win_rate),
        "risk":       min(100, max(0, int(avg_r * 25))),
        "discipline": min(100, int(len([t for t in trades if _enum_val(t.grade) in ["a_plus", "a"]]) / total * 100)) if total else 0,
        "execution":  min(100, int(len([t for t in trades if t.emotion and _enum_val(t.emotion) == "calm"]) / total * 100)) if total else 0,
        "resilience": min(100, max(0, 50 + streak * 10)),
    }

    return {
        "summary": {
            "total_trades":  total,
            "net_pnl":       round(net_pnl, 2),
            "gross_profit":  round(gross_profit, 2),
            "gross_loss":    round(gross_loss, 2),
            "profit_factor": profit_factor,
            "win_rate":      win_rate,
            "wins":          len(wins),
            "losses":        len(losses),
            "breakeven":     len(breakeven),
            "avg_win":       avg_win,
            "avg_loss":      avg_loss,
            "avg_r_multiple": avg_r,
            "expectancy":    expectancy,
            "current_streak": streak,
        },
        "forge_score":   forge_score,
        "by_kill_zone":  kz_stats,
        "by_setup":      setup_stats,
        "cumulative_pnl": cumulative,
    }


@router.get("/by-killzone")
async def get_by_killzone(
    account_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Standalone kill zone breakdown — returns array for direct chart use."""
    base = select(Trade).join(Account).where(
        Account.user_id == current_user.id,
        Trade.kill_zone.isnot(None),
    )
    if account_id:
        base = base.where(Trade.account_id == account_id)

    result = await db.execute(base)
    trades = result.scalars().all()

    stats = {}
    for t in trades:
        kz = _enum_val(t.kill_zone)
        if kz not in stats:
            stats[kz] = {"trades": 0, "wins": 0, "losses": 0, "pnl": 0}
        stats[kz]["trades"] += 1
        if t.pnl and t.pnl > 0:
            stats[kz]["wins"] += 1
        elif t.pnl and t.pnl < 0:
            stats[kz]["losses"] += 1
        stats[kz]["pnl"] += t.pnl or 0

    return [
        {
            "name":     kz,
            "trades":   v["trades"],
            "wins":     v["wins"],
            "losses":   v["losses"],
            "pnl":      round(v["pnl"], 2),
            "win_rate": round(v["wins"] / v["trades"] * 100, 1) if v["trades"] else 0,
        }
        for kz, v in sorted(stats.items(), key=lambda x: x[1]["pnl"], reverse=True)
    ]


@router.get("/by-setup")
async def get_by_setup(
    account_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Standalone setup breakdown — returns array for direct chart use."""
    base = select(Trade).join(Account).where(
        Account.user_id == current_user.id,
        Trade.setup.isnot(None),
    )
    if account_id:
        base = base.where(Trade.account_id == account_id)

    result = await db.execute(base)
    trades = result.scalars().all()

    stats = {}
    for t in trades:
        s = _enum_val(t.setup)
        if s not in stats:
            stats[s] = {"trades": 0, "wins": 0, "losses": 0, "pnl": 0, "r_total": 0}
        stats[s]["trades"] += 1
        if t.pnl and t.pnl > 0:
            stats[s]["wins"] += 1
        elif t.pnl and t.pnl < 0:
            stats[s]["losses"] += 1
        stats[s]["pnl"]     += t.pnl or 0
        stats[s]["r_total"] += t.r_multiple or 0

    return [
        {
            "name":     setup,
            "trades":   v["trades"],
            "wins":     v["wins"],
            "losses":   v["losses"],
            "pnl":      round(v["pnl"], 2),
            "win_rate": round(v["wins"] / v["trades"] * 100, 1) if v["trades"] else 0,
            "avg_r":    round(v["r_total"] / v["trades"], 2) if v["trades"] else 0,
        }
        for setup, v in sorted(stats.items(), key=lambda x: x[1]["pnl"], reverse=True)
    ]


@router.get("/pnl-curve")
async def get_pnl_curve(
    account_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cumulative P&L curve — returns [{date, pnl, cumulative}] sorted ascending."""
    base = select(Trade).join(Account).where(
        Account.user_id == current_user.id,
        Trade.pnl.isnot(None),
    )
    if account_id:
        base = base.where(Trade.account_id == account_id)

    result = await db.execute(base.order_by(Trade.entry_time))
    trades = result.scalars().all()

    cumulative = []
    running = 0
    for t in trades:
        running += t.pnl or 0
        cumulative.append({
            "date":       t.entry_time.strftime("%Y-%m-%d"),
            "value":      round(running, 2),   # "value" key matches Recharts dataKey
            "pnl":        round(t.pnl or 0, 2),
        })

    return cumulative


@router.get("/heatmap")
async def get_heatmap(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Trade).join(Account).where(Account.user_id == current_user.id)
    )
    trades = result.scalars().all()

    heatmap = {}
    for t in trades:
        day = t.entry_time.strftime("%Y-%m-%d")
        if day not in heatmap:
            heatmap[day] = {"pnl": 0, "trades": 0, "wins": 0}
        heatmap[day]["pnl"]    += t.pnl or 0
        heatmap[day]["trades"] += 1
        if t.pnl and t.pnl > 0:
            heatmap[day]["wins"] += 1

    return [{"date": k, **v} for k, v in sorted(heatmap.items())]