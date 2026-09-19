import os
import sqlite3
from pathlib import Path
from typing import List, Optional, Dict, Any

DB_PATH = os.getenv('SQLITE_DB_PATH', '/app/data/db.sqlite3')

def _get_connection():
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = _get_connection()
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS work_items (
                id TEXT PRIMARY KEY,
                key TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL,
                status TEXT NOT NULL,
                priority TEXT NOT NULL,
                assignee TEXT NOT NULL
            )
        """)
        cur = conn.execute("SELECT COUNT(*) FROM work_items")
        if cur.fetchone()[0] == 0:
            seed_items = [
                ("item-1", "DAV-1", "Configure Nginx reverse proxy & Cloudflared tunnel target", "DONE", "HIGH", "Dimitar"),
                ("item-2", "DAV-2", "Set up Django Ninja 1.7+ & Python 3.14 backend API", "DONE", "HIGH", "Dimitar"),
                ("item-3", "DAV-3", "Build React 19 + Vite 8 Kanban board interface", "IN_PROGRESS", "MEDIUM", "Dimitar"),
                ("item-4", "DAV-4", "Connect Authelia WebAuthn / Passkey auth flow", "TODO", "HIGH", "Dimitar"),
                ("item-5", "DAV-5", "Add Strawberry GraphQL schema & GraphiQL IDE support", "DONE", "MEDIUM", "Dimitar"),
                ("item-6", "DAV-6", "Implement MCP Server interface for LLM agents", "DONE", "HIGH", "LLM Agent"),
            ]
            conn.executemany(
                "INSERT INTO work_items (id, key, title, status, priority, assignee) VALUES (?, ?, ?, ?, ?, ?)",
                seed_items
            )
    conn.close()

# Auto-initialize on import
init_db()

def list_items(status: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = _get_connection()
    try:
        if status:
            cur = conn.execute("SELECT * FROM work_items WHERE UPPER(status) = UPPER(?) ORDER BY key", (status,))
        else:
            cur = conn.execute("SELECT * FROM work_items ORDER BY key")
        return [dict(row) for row in cur.fetchall()]
    finally:
        conn.close()

def get_item(key_or_id: str) -> Optional[Dict[str, Any]]:
    conn = _get_connection()
    try:
        cur = conn.execute(
            "SELECT * FROM work_items WHERE UPPER(key) = UPPER(?) OR id = ?",
            (key_or_id, key_or_id)
        )
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def add_item(title: str, priority: str = "MEDIUM", assignee: str = "Unassigned", status: str = "TODO") -> Dict[str, Any]:
    conn = _get_connection()
    try:
        with conn:
            cur = conn.execute("SELECT COUNT(*) FROM work_items")
            next_num = cur.fetchone()[0] + 1
            item_id = f"item-{next_num}"
            item_key = f"DAV-{next_num}"
            conn.execute(
                "INSERT INTO work_items (id, key, title, status, priority, assignee) VALUES (?, ?, ?, ?, ?, ?)",
                (item_id, item_key, title, status.upper(), priority.upper(), assignee)
            )
            return {
                "id": item_id,
                "key": item_key,
                "title": title,
                "status": status.upper(),
                "priority": priority.upper(),
                "assignee": assignee
            }
    finally:
        conn.close()

def update_status(key: str, new_status: str) -> Optional[Dict[str, Any]]:
    conn = _get_connection()
    try:
        with conn:
            conn.execute(
                "UPDATE work_items SET status = UPPER(?) WHERE UPPER(key) = UPPER(?) OR id = ?",
                (new_status, key, key)
            )
    finally:
        conn.close()
    return get_item(key)
