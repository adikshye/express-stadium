# Express — Веб-система предзаказа еды на стадионе без очередей

Сквозной проект **«Express»** (ЛЗ-6 — ЛЗ-15): веб-приложение для быстрого предзаказа еды и напитков на фуд-корте стадиона с оплатой через **Kaspi QR**, получением 5-значного кода выдачи без очередей и Kanban-доской продавца с ограничением незавершенной работы (**WIP Limit: 3**).

## Архитектура и состав репозитория

| Модуль / Файл | Назначение | Лабораторная работа |
| :--- | :--- | :--- |
| `docker-compose.yml`, `db/init.sql` | PostgreSQL 15 (`healthcheck`) + FastAPI контейнер | ЛЗ-15 |
| `backend/main.py`, `backend/test_main.py` | REST API (`/api/health`, `/api/menu`, `/api/orders`, `/api/reviews` с маскированием ПДн и SQLite fallback) + `pytest` | ЛЗ-7, ЛЗ-10, ЛЗ-12, ЛЗ-15 |
| `frontend/index.html`, `frontend/seller.html`, `frontend/style.css`, `frontend/script.js` | Витрина клиента (Offline-корзина, Kaspi QR Mock) и Kanban-доска продавца (`WIP: 3`) | ЛЗ-9, ЛЗ-15 |
| `docs/simulation/monte_carlo.py`, `docs/simulation/monte_carlo_histogram.png` | Вероятностный прогноз сроков (10 000 прогонов, P50 = 9 апта, P85 = 11 апта) | ЛЗ-6 |
| `docs/security/threat-model.json` | Модель угроз STRIDE (6 категорий, меры защиты `EXP-18`..`EXP-20`) | ЛЗ-7 |
| `docs/adr/0001-model-postavki.md`, `docs/adr/ADR-002-ai-classifier.md` | Архитектурные решения (Kanban + WIP-лимиты, ИИ-классификатор отзывов) | ЛЗ-6, ЛЗ-12 |
| `docs/ai/eval_dataset.csv` | Эталонный датасет оценки качества ИИ (30 примеров, 27 Pass / 3 Fail = 90% Accuracy) | ЛЗ-12 |
| `scripts/generate_dashboards.py`, `docs/dora_dashboard.png`, `docs/project_dashboard.png` | Генерация дашбордов DORA Metrics и Executive Dashboard | ЛЗ-10, ЛЗ-14 |
| `scripts/pm_ai_assistant.py`, `docs/latest_ai_status_report.md` | Автоматический PM ИИ-ассистент для еженедельных статус-отчетов | ЛЗ-13 |
| `.github/workflows/ci.yml`, `.github/workflows/ai_pm_report.yml` | CI/CD пайплайн (`pytest` + `Trivy`) и cron-отчет по пятницам в 18:00 | ЛЗ-10, ЛЗ-13 |
| `scripts/sync_github_issues.sh` | Скрипт синхронизации Issues (`EXP-18`..`EXP-28`, `BUG-01`) и GitHub Projects | ЛЗ-7 — ЛЗ-12 |

## Быстрый запуск

### 1. Запуск через Docker Compose (PostgreSQL + FastAPI)
```bash
docker compose up --build
```
После запуска откройте:
- Витрина клиента: `http://localhost:8000/`
- Kanban-доска продавца: `http://localhost:8000/seller.html`
- Проверка здоровья: `http://localhost:8000/api/health`

### 2. Локальный запуск автотестов (Python / pytest)
```bash
pip install -r backend/requirements.txt
cd backend && pytest test_main.py -v
```

### 3. Запуск Web Preview (Node.js / Port 3000)
```bash
npm install
npm run dev
```

---

## Правила готовности и завершенности (ЛЗ-9)

- **DoR (Definition of Ready):** Задача четко описана, оценена в Story Points, привязана к релизу и содержит критерии приемки (Given-When-Then).
- **DoD (Definition of Done):** Код написан, покрыт автотестами (`pytest`), прошел проверку безопасности Trivy, прошел Code Review и влит в ветку `main`.