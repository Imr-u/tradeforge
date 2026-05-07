from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.db.database import get_db
from app.models.models import Trade, Account, KillZoneEnum, SetupEnum, EmotionEnum, GradeEnum, DirectionEnum
from app.deps import get_current_user
from app.models.models import User
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter()


class TradeIn(BaseModel):
    account_id:  int
    symbol:      str
    direction:   str
    entry:       float
    exit:        Optional[float] = None   # was exit_price — renamed to match Trade model
    sl:          Optional[float] = None   # now optional — can't always know SL at log time
    tp:          Optional[float] = None
    contracts:   float = 1.0
    entry_time:  datetime
    exit_time:   Optional[datetime] = None
    kill_zone:   Optional[str] = None
    setup:       Optional[str] = None
    emotion:     Optional[str] = None
    grade:       Optional[str] = None
    notes:       Optional[str] = None


@router.post("/")
async def create_trade(
    trade_in: TradeIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify account belongs to current user
    acc_result = await db.execute(
        select(Account).where(
            Account.id == trade_in.account_id,
            Account.user_id == current_user.id
        )
    )
    if not acc_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Account not found or not yours")

    # Auto-calculate P&L and R:R only when we have both entry and exit
    pnl        = None
    r_multiple = None

    if trade_in.exit is not None:
        diff = trade_in.exit - trade_in.entry
        if trade_in.direction.lower() == "short":
            diff = -diff
        pnl = round(diff * trade_in.contracts, 2)

        if trade_in.sl is not None:
            risk = abs(trade_in.entry - trade_in.sl)
            r_multiple = round(diff / risk, 2) if risk > 0 else 0

    trade = Trade(
        account_id  = trade_in.account_id,
        symbol      = trade_in.symbol.upper(),
        direction   = trade_in.direction.lower(),
        entry       = trade_in.entry,
        exit        = trade_in.exit,
        sl          = trade_in.sl,
        tp          = trade_in.tp,
        contracts   = trade_in.contracts,
        pnl         = pnl,
        r_multiple  = r_multiple,
        entry_time  = trade_in.entry_time,
        exit_time   = trade_in.exit_time,
        kill_zone   = trade_in.kill_zone,
        setup       = trade_in.setup,
        emotion     = trade_in.emotion,
        grade       = trade_in.grade,
        notes       = trade_in.notes,
    )
    db.add(trade)
    await db.commit()
    await db.refresh(trade)
    return trade


@router.get("/")
async def get_trades(
    symbol:    Optional[str] = None,
    direction: Optional[str] = None,
    limit:     int = 100,
    offset:    int = 0,
    db:        AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = (
        select(Trade)
        .join(Account)
        .where(Account.user_id == current_user.id)
        .order_by(desc(Trade.entry_time))
        .limit(limit)
        .offset(offset)
    )
    if symbol:
        query = query.where(Trade.symbol == symbol.upper())
    if direction:
        query = query.where(Trade.direction == direction.lower())

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{trade_id}")
async def get_trade(
    trade_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Trade).join(Account).where(
            Trade.id == trade_id,
            Account.user_id == current_user.id
        )
    )
    trade = result.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    return trade