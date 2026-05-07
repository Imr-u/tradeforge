from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.models.models import Account, User
from app.deps import get_current_user
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class AccountIn(BaseModel):
    name: str
    broker: Optional[str] = None
    currency: str = "USD"
    balance: float = 0.0

@router.post("/")
async def create_account(
    body: AccountIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    account = Account(
        user_id=current_user.id,
        name=body.name,
        broker=body.broker,
        currency=body.currency,
        balance=body.balance
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account

@router.get("/")
async def get_accounts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Account).where(Account.user_id == current_user.id))
    return result.scalars().all()