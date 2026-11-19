-- Express Stadium MVP Database Schema (PostgreSQL 15)

CREATE TABLE IF NOT EXISTS menu_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    category VARCHAR(60) NOT NULL,
    description TEXT NOT NULL,
    price_kzt INTEGER NOT NULL CHECK (price_kzt > 0),
    prep_minutes INTEGER NOT NULL DEFAULT 5,
    available BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY,
    pickup_code VARCHAR(5) NOT NULL,
    sector VARCHAR(40) NOT NULL,
    seat VARCHAR(40) NOT NULL,
    items_json JSONB NOT NULL,
    total_kzt INTEGER NOT NULL CHECK (total_kzt > 0),
    payment_method VARCHAR(40) NOT NULL DEFAULT 'Kaspi QR',
    status VARCHAR(30) NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    order_id UUID NOT NULL,
    action VARCHAR(60) NOT NULL,
    actor VARCHAR(80) NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY,
    order_code VARCHAR(10),
    redacted_text TEXT NOT NULL,
    pii_masked BOOLEAN NOT NULL DEFAULT FALSE,
    ai_category VARCHAR(40) NOT NULL,
    confidence NUMERIC(4,2) NOT NULL DEFAULT 0.90,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO menu_items (name, category, description, price_kzt, prep_minutes)
VALUES
    ('Express Smash Бургер', 'Бургеры', 'Двойная говяжья котлета, выдержанный чеддер, маринованные огурцы, соус в бриоши', 2400, 6),
    ('Стадионный Гриль Хот-дог', 'Закуски', 'Говяжья сосиска на гриле, карамелизованный лук, хрустящий шалот, зернистая горчица', 1500, 4),
    ('Крылышки BBQ + Картофель Фри', 'Комбо', 'Хрустящие крылышки в глазури BBQ, порция картофеля фри и чесночный соус', 2900, 7),
    ('Комбо Болельщика', 'Комбо', 'Express Smash Бургер, картофель фри и охлажденный напиток 0.5 л', 3400, 7),
    ('Ягодный Лимонад / Кола 0.5л', 'Напитки', 'Охлажденный газированный напиток со льдом и свежим лимоном в герметичном стакане', 850, 2),
    ('Картофель Фри XL', 'Закуски', 'Золотистый картофель с морской солью и специями в удобном картонном лотке', 1100, 4)
ON CONFLICT DO NOTHING;
