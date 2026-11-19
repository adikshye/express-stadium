"""Unit tests for Express Stadium MVP Backend (LZ-10 & LZ-15)."""

import os
import tempfile
import uuid

import pytest
from fastapi.testclient import TestClient

# Isolate test database in a temporary file before importing app
_tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp_db.close()
os.environ["SQLITE_PATH"] = _tmp_db.name
os.environ["WIP_LIMIT"] = "3"

from main import app, init_db  # noqa: E402

init_db()
client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["wip_limit"] == 3
    assert data["database"] in {"sqlite", "postgresql"}


def test_menu_catalog():
    response = client.get("/api/menu")
    assert response.status_code == 200
    items = response.json()
    assert len(items) >= 4
    assert all("price_kzt" in item and item["price_kzt"] > 0 for item in items)


def test_create_order_uuid_and_pickup_code_and_status_transition():
    create_resp = client.post(
        "/api/orders",
        json={
            "sector": "Сектор A",
            "seat": "Ряд 12, Место 5",
            "items": [{"menu_item_id": 1, "quantity": 2}],
            "payment_method": "Kaspi QR",
        },
    )
    assert create_resp.status_code == 201
    order = create_resp.json()

    # EXP-19: Verify valid UUIDv4
    parsed_uuid = uuid.UUID(order["id"])
    assert parsed_uuid.version == 4

    # BUG-01 fix: Verify 5-digit pickup code
    assert len(order["pickup_code"]) == 5
    assert order["pickup_code"].isdigit()

    # STRIDE Tampering mitigation: 2 x 2400 KZT = 4800 KZT calculated server-side
    assert order["total_kzt"] == 4800
    assert order["status"] == "new"

    # Transition status: new -> in_progress -> ready
    patch_resp = client.patch(
        f"/api/orders/{order['id']}/status",
        json={"status": "in_progress", "actor": "seller_test"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["status"] == "in_progress"

    ready_resp = client.patch(
        f"/api/orders/{order['id']}/status",
        json={"status": "ready", "actor": "seller_test"},
    )
    assert ready_resp.status_code == 200
    assert ready_resp.json()["status"] == "ready"


def test_review_pii_redaction_and_ai_classification():
    raw_review = "Оплата через Kaspi QR прошла дважды, позвоните мне +7 701 555 44 33 или test@example.com"
    resp = client.post(
        "/api/reviews",
        json={"text": raw_review, "order_code": "48291"},
    )
    assert resp.status_code == 201
    data = resp.json()

    # EXP-28: Verify zero PII leakage
    assert "[PHONE_REDACTED]" in data["redacted_text"]
    assert "[EMAIL_REDACTED]" in data["redacted_text"]
    assert "701" not in data["redacted_text"]
    assert "test@example.com" not in data["redacted_text"]
    assert data["pii_masked"] is True

    # LZ-12: Verify AI classification taxonomy
    assert data["ai_category"] == "Payment Issue"
