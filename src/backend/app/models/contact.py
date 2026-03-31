from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class Contact(SQLModel, table=True):
    __tablename__ = "contact"

    id: str = Field(primary_key=True)
    lead_id: Optional[str] = Field(default=None, foreign_key="lead.id", index=True)
    customer_id: Optional[str] = Field(default=None, foreign_key="customer.id", index=True)
    name: str
    role: Optional[str] = Field(default=None)
    is_key_decision_maker: bool = Field(default=False)
    wechat_id: Optional[str] = Field(default=None, index=True)
    phone: Optional[str] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ContactRelation(SQLModel, table=True):
    __tablename__ = "contact_relation"

    id: str = Field(primary_key=True)
    contact_a_id: str = Field(foreign_key="contact.id", index=True)
    contact_b_id: str = Field(foreign_key="contact.id", index=True)
    relation_type: str  # e.g. "same_wechat", "same_phone", "manual"
    note: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
