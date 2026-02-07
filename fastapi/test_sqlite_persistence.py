import os
import pytest
from ml.infrastructure.db.sqlite import create_db_and_tables, create_thread, add_message, get_thread_history, engine, SQLModel

# Use a test database file
import ml.infrastructure.db.sqlite
ml.infrastructure.db.sqlite.sqlite_file_name = "test_database.db"
ml.infrastructure.db.sqlite.sqlite_url = f"sqlite:///test_database.db"
ml.infrastructure.db.sqlite.engine = ml.infrastructure.db.sqlite.create_engine(ml.infrastructure.db.sqlite.sqlite_url)

def setup_module():
    create_db_and_tables()

def teardown_module():
    if os.path.exists("test_database.db"):
        os.remove("test_database.db")

def test_sqlite_persistence():
    thread_id = "test-thread-123"
    
    print(f"\nTesting persistence for thread: {thread_id}")
    
    # 1. Create Thread
    thread = create_thread(thread_id, title="Test Conversation")
    assert thread.id == thread_id
    print("✅ Thread created")
    
    # 2. Add User Message
    msg1 = add_message(thread_id, "user", "Hello agent!")
    assert msg1.content == "Hello agent!"
    print("✅ User message added")
    
    # 3. Add Assistant Message
    msg2 = add_message(thread_id, "assistant", "Hello user!")
    assert msg2.content == "Hello user!"
    print("✅ Assistant message added")
    
    # 4. Add Tool Message
    tool_calls = [{"name": "test_tool", "args": {"foo": "bar"}}]
    msg3 = add_message(thread_id, "assistant", "Using tool...", tool_calls=tool_calls)
    assert msg3.tool_calls_list[0]["name"] == "test_tool"
    print("✅ Tool message added")
    
    # 5. Retrieve History
    history = get_thread_history(thread_id)
    assert len(history) == 3
    assert history[0]["role"] == "user"
    assert history[1]["role"] == "assistant"
    assert "tool_calls" in history[2]
    print(f"✅ History retrieved: {len(history)} messages")

if __name__ == "__main__":
    setup_module()
    try:
        test_sqlite_persistence()
        print("\n🎉 ALL TESTS PASSED")
    finally:
        teardown_module()
