from typing import Optional, List, Dict, Any
from datetime import datetime
import json
from sqlmodel import Field, Session, SQLModel, create_engine, select
from loguru import logger

# Database file path
sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

engine = create_engine(sqlite_url)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


class Thread(SQLModel, table=True):
    id: str = Field(primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    title: Optional[str] = None


class Message(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    thread_id: str = Field(foreign_key="thread.id", index=True)
    role: str  # user, assistant, tool
    content: str
    tool_calls: Optional[str] = None  # JSON string
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @property
    def tool_calls_list(self) -> List[Dict[str, Any]]:
        if not self.tool_calls:
            return []
        try:
            return json.loads(self.tool_calls)
        except json.JSONDecodeError:
            return []


def get_session():
    with Session(engine) as session:
        yield session


def get_thread(thread_id: str) -> Optional[Thread]:
    with Session(engine) as session:
        return session.get(Thread, thread_id)


def create_thread(thread_id: str, title: Optional[str] = None) -> Thread:
    with Session(engine) as session:
        thread = session.get(Thread, thread_id)
        if not thread:
            thread = Thread(id=thread_id, title=title)
            session.add(thread)
            session.commit()
            session.refresh(thread)
        return thread


def add_message(
    thread_id: str,
    role: str,
    content: str,
    tool_calls: Optional[List[Dict[str, Any]]] = None
) -> Message:
    with Session(engine) as session:
        # Ensure thread exists
        if not session.get(Thread, thread_id):
            create_thread(thread_id)
            
        message = Message(
            thread_id=thread_id,
            role=role,
            content=content,
            tool_calls=json.dumps(tool_calls) if tool_calls else None
        )
        session.add(message)
        
        # Update thread timestamp
        thread = session.get(Thread, thread_id)
        if thread:
            thread.updated_at = datetime.utcnow()
            session.add(thread)
            
        session.commit()
        session.refresh(message)
        return message


def get_thread_history(thread_id: str) -> List[Dict[str, Any]]:
    with Session(engine) as session:
        statement = select(Message).where(Message.thread_id == thread_id).order_by(Message.created_at)
        messages = session.exec(statement).all()
        
        history = []
        for msg in messages:
            message_dict = {
                "role": msg.role,
                "content": msg.content
            }
            if msg.tool_calls:
                message_dict["tool_calls"] = msg.tool_calls_list
            history.append(message_dict)
            
        return history


def get_all_threads() -> List[Thread]:
    with Session(engine) as session:
        statement = select(Thread).order_by(Thread.updated_at.desc())
        threads = session.exec(statement).all()
        return threads
