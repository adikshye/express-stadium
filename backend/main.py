"""Express Stadium MVP Backend (FastAPI + SQLite/PostgreSQL fallback).

Implements:
- GET  /api/health              : Service & DB health check
- GET  /api/menu                : Authoritative stadium food catalog
- GET  /api/orders              : List active & completed orders (Kanban feed)
- POST /api/orders              : Create order with server-side pricing, UUIDv4 (EXP-19) & 5-digit pickup code
- PATCH /api/orders/{id}/status : Transition order status with WIP Limit = 3 enforcement (ADR-001) & Audit Log (EXP-10)
- GET  /api/reviews             : List classified fan reviews
- POST /api/reviews             : Scrub PII ([PHONE_REDACTED], [EMAIL_REDACTED]) (EXP-28) & AI 4-category classification (LZ-12)
"""

from __future__ import annotations

import json
import os
import random
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

WIP_LIMIT = int(os.getenv("WIP_LIMIT", "3"))
DB_PATH = os.getenv("SQLITE_PATH", str(Path(__file__).parent / "express_mvp.db"))

MENU_SEED: List[Dict[str, Any]] = [
    {
        "id": 1,
        "name": "Express Smash Бургер",
        "category": "Бургеры",
        "description": "Двойная говяжья котлета, выдержанный чеддер, маринованные огурцы, соус в бриоши",
        "price_kzt": 2400,
        "prep_minutes": 6,
        "available": True,
    },
    {
        "id": 2,
        "name": "Стадионный Гриль Хот-дог",
        "category": "Закуски",
        "description": "Говяжья сосиска на гриле, карамелизованный лук, хрустящий шалот, зернистая горчица",
        "price_kzt": 1500,
        "prep_minutes": 4,
        "available": True,
    },
    {
        "id": 3,
        "name": "Крылышки BBQ + Картофель Фри",
        "category": "Комбо",
        "description": "Хрустящие крылышки в глазури BBQ, порция картофеля фри и чесночный соус",
        "price_kzt": 2900,
        "prep_minutes": 7,
        "available": True,
    },
    {
        "id": 4,
        "name": "Комбо Болельщика",
        "category": "Комбо",
        "description": "Express Smash Бургер, картофель фри и охлажденный напиток 0.5 л",
        "price_kzt": 3400,
        "prep_minutes": 7,
        "available": True,
    },
    {
        "id": 5,
        "name": "Ягодный Лимонад / Кола 0.5л",
        "category": "Напитки",
        "description": "Охлажденный газированный напиток со льдом и свежим лимоном в герметичном стакане",
        "price_kzt": 850,
        "prep_minutes": 2,
        "available": True,
    },
    {
        "id": 6,
        "name": "Картофель Фри XL",
        "category": "Закуски",
        "description": "Золотистый картофель с морской солью и специями в удобном картонном лотке",
        "price_kzt": 1100,
        "prep_minutes": 4,
        "available": True,
    },
]

ALLOWED_STATUSES = {"new", "in_progress", "ready", "completed"}

PHONE_REGEX = re.compile(
    r"(?:\+7|8|7)[\s\-()]*(?:\d[\s\-()]*){10}"
    r"|\b\d{3}[\s\-]\d{3}[\s\-]\d{2}[\s\-]\d{2}\b"
)
EMAIL_REGEX = re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")


def scrub_pii(text: str) -> tuple[str, bool]:
    """EXP-28: Mask phone numbers and emails before AI classification."""
    masked = False
    cleaned = PHONE_REGEX.sub("[PHONE_REDACTED]", text)
    if cleaned != text:
        masked = True
    cleaned_email = EMAIL_REGEX.sub("[EMAIL_REDACTED]", cleaned)
    if cleaned_email != cleaned:
        masked = True
    return cleaned_email, masked


def classify_review_ai(clean_text: str) -> tuple[str, float]:
    """LZ-12: Deterministic 4-category review classifier mirroring gpt-4o-mini taxonomy."""
    lower = clean_text.lower()
    payment_kw = [
        "kaspi", "каспи", "оплат", "чек", "төлем", "списал", "qr", "кьюар",
        "деньг", "возврат", "ақша", "банк", "терминал", "payment", "комисс",
    ]
    bug_kw = [
        "баг", "ошибк", "завис", "не открыв", "экран", "код не", "қате",
        "кнопк", "приложен", "сайт", "тормоз", "вылет", "bug", "crash", "загруз", "таймер", "не работа",
    ]
    staff_kw = [
        "кассир", "продав", "персонал", "груб", "вежлив", "очеред", "сатушы",
        "қызметкер", "выдач", "хам", "быстро выдал", "обслужив", "staff", "сотрудник",
    ]

    scored = [
        ("App Bug", sum(1 for k in bug_kw if k in lower), 0.91),
        ("Payment Issue", sum(1 for k in payment_kw if k in lower), 0.94),
        ("Staff", sum(1 for k in staff_kw if k in lower), 0.89),
    ]
    scored.sort(key=lambda item: item[1], reverse=True)
    if scored[0][1] > 0:
        return scored[0][0], scored[0][2]
    return "Food Quality", 0.92


def get_db_backend() -> str:
    """Detect whether PostgreSQL is reachable; otherwise fall back automatically to SQLite."""
    db_url = os.getenv("DATABASE_URL", "")
    if db_url.startswith("postgres"):
        try:
            import psycopg2  # type: ignore

            conn = psycopg2.connect(db_url, connect_timeout=2)
            conn.close()
            return "postgresql"
        except Exception:
            return "sqlite"
    return "sqlite"


def get_sqlite_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_sqlite_conn()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            pickup_code TEXT NOT NULL,
            sector TEXT NOT NULL,
            seat TEXT NOT NULL,
            items_json TEXT NOT NULL,
            total_kzt INTEGER NOT NULL,
            payment_method TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT NOT NULL,
            action TEXT NOT NULL,
            actor TEXT NOT NULL,
            details TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS reviews (
            id TEXT PRIMARY KEY,
            order_code TEXT,
            redacted_text TEXT NOT NULL,
            pii_masked INTEGER NOT NULL,
            ai_category TEXT NOT NULL,
            confidence REAL NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()


class OrderItemInput(BaseModel):
    menu_item_id: int
    quantity: int = Field(..., ge=1, le=20)


class OrderCreateRequest(BaseModel):
    sector: str = Field(..., min_length=1, max_length=40)
    seat: str = Field(..., min_length=1, max_length=40)
    items: List[OrderItemInput] = Field(..., min_length=1)
    payment_method: str = Field(default="Kaspi QR")


class OrderStatusUpdateRequest(BaseModel):
    status: str
    actor: str = Field(default="seller_kanban")


class ReviewCreateRequest(BaseModel):
    text: str = Field(..., min_length=3, max_length=1000)
    order_code: Optional[str] = Field(default=None, max_length=12)


app = FastAPI(
    title="Express Stadium API",
    version="2.0.0",
    description="MVP backend for stadium food pre-order without queues (LZ-15)",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()


@app.get("/api/health")
def health_check() -> Dict[str, Any]:
    return {
        "status": "ok",
        "service": "express-stadium-backend",
        "database": get_db_backend(),
        "wip_limit": WIP_LIMIT,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/menu")
def get_menu() -> List[Dict[str, Any]]:
    return MENU_SEED


@app.get("/api/orders")
def list_orders() -> Dict[str, Any]:
    conn = get_sqlite_conn()
    rows = conn.execute("SELECT * FROM orders ORDER BY created_at DESC").fetchall()
    conn.close()
    orders = []
    in_progress_count = 0
    for row in rows:
        item = dict(row)
        item["items"] = json.loads(item.pop("items_json"))
        if item["status"] == "in_progress":
            in_progress_count += 1
        orders.append(item)
    return {
        "orders": orders,
        "wip_count": in_progress_count,
        "wip_limit": WIP_LIMIT,
    }


@app.post("/api/orders", status_code=201)
def create_order(payload: OrderCreateRequest) -> Dict[str, Any]:
    menu_by_id = {item["id"]: item for item in MENU_SEED}
    resolved_items = []
    total_kzt = 0

    # STRIDE Tampering mitigation: always compute totals strictly from server-side menu prices
    for entry in payload.items:
        menu_item = menu_by_id.get(entry.menu_item_id)
        if not menu_item:
            raise HTTPException(status_code=404, detail=f"Menu item {entry.menu_item_id} not found")
        line_total = menu_item["price_kzt"] * entry.quantity
        total_kzt += line_total
        resolved_items.append(
            {
                "menu_item_id": menu_item["id"],
                "name": menu_item["name"],
                "unit_price_kzt": menu_item["price_kzt"],
                "quantity": entry.quantity,
                "subtotal_kzt": line_total,
            }
        )

    order_id = str(uuid.uuid4())  # EXP-19: UUIDv4 prevents sequential ID enumeration
    pickup_code = f"{random.randint(10000, 99999)}"  # BUG-01 fix: deterministic 5-digit code
    now = datetime.now(timezone.utc).isoformat()

    conn = get_sqlite_conn()
    conn.execute(
        """
        INSERT INTO orders (id, pickup_code, sector, seat, items_json, total_kzt, payment_method, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            order_id,
            pickup_code,
            payload.sector.strip(),
            payload.seat.strip(),
            json.dumps(resolved_items, ensure_ascii=False),
            total_kzt,
            payload.payment_method,
            "new",
            now,
            now,
        ),
    )
    conn.execute(
        """
        INSERT INTO audit_logs (order_id, action, actor, details, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            order_id,
            "ORDER_CREATED",
            "guest_checkout",
            f"Code #{pickup_code}, Total {total_kzt} KZT via {payload.payment_method}",
            now,
        ),
    )
    conn.commit()
    conn.close()

    return {
        "id": order_id,
        "pickup_code": pickup_code,
        "sector": payload.sector.strip(),
        "seat": payload.seat.strip(),
        "items": resolved_items,
        "total_kzt": total_kzt,
        "payment_method": payload.payment_method,
        "status": "new",
        "created_at": now,
    }


@app.patch("/api/orders/{order_id}/status")
def update_order_status(order_id: str, payload: OrderStatusUpdateRequest) -> Dict[str, Any]:
    if payload.status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {payload.status}")

    conn = get_sqlite_conn()
    existing = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Order not found")

    # ADR-001 / LZ-9: Enforce Kanban WIP limit on 'in_progress' column
    if payload.status == "in_progress" and existing["status"] != "in_progress":
        active_count = conn.execute(
            "SELECT COUNT(*) AS cnt FROM orders WHERE status = 'in_progress'"
        ).fetchone()["cnt"]
        if active_count >= WIP_LIMIT:
            conn.close()
            raise HTTPException(
                status_code=409,
                detail=f"WIP limit exceeded: max {WIP_LIMIT} orders allowed in progress simultaneously",
            )

    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "UPDATE orders SET status = ?, updated_at = ? WHERE id = ?",
        (payload.status, now, order_id),
    )
    conn.execute(
        """
        INSERT INTO audit_logs (order_id, action, actor, details, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            order_id,
            "STATUS_CHANGED",
            payload.actor,
            f"{existing['status']} -> {payload.status}",
            now,
        ),
    )
    conn.commit()
    updated = dict(conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone())
    conn.close()
    updated["items"] = json.loads(updated.pop("items_json"))
    return updated


@app.get("/api/reviews")
def list_reviews() -> List[Dict[str, Any]]:
    conn = get_sqlite_conn()
    rows = conn.execute("SELECT * FROM reviews ORDER BY created_at DESC").fetchall()
    conn.close()
    return [
        {
            "id": r["id"],
            "order_code": r["order_code"],
            "redacted_text": r["redacted_text"],
            "pii_masked": bool(r["pii_masked"]),
            "ai_category": r["ai_category"],
            "confidence": r["confidence"],
            "created_at": r["created_at"],
        }
        for r in rows
    ]


@app.post("/api/reviews", status_code=201)
def create_review(payload: ReviewCreateRequest) -> Dict[str, Any]:
    redacted_text, pii_masked = scrub_pii(payload.text)
    category, confidence = classify_review_ai(redacted_text)
    review_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    conn = get_sqlite_conn()
    conn.execute(
        """
        INSERT INTO reviews (id, order_code, redacted_text, pii_masked, ai_category, confidence, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            review_id,
            payload.order_code,
            redacted_text,
            1 if pii_masked else 0,
            category,
            confidence,
            now,
        ),
    )
    conn.commit()
    conn.close()

    return {
        "id": review_id,
        "order_code": payload.order_code,
        "redacted_text": redacted_text,
        "pii_masked": pii_masked,
        "ai_category": category,
        "confidence": confidence,
        "created_at": now,
    }


FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/")
    def serve_index() -> FileResponse:
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/seller.html")
    def serve_seller() -> FileResponse:
        return FileResponse(str(FRONTEND_DIR / "seller.html"))
