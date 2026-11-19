#!/usr/bin/env bash
# Express Stadium — GitHub Issues & Projects Sync Script (LZ-7 .. LZ-12)
# Run in an authenticated GitHub repo terminal: bash scripts/sync_github_issues.sh
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: GitHub CLI (gh) is not installed. Install from https://cli.github.com/"
  exit 1
fi

echo "Checking existing issues..."
EXISTING=$(gh issue list --state all --limit 200 --json number,title)

ensure_issue() {
  local code="$1"
  local title="$2"
  local body="$3"
  local label="$4"
  local should_close="$5"

  if echo "$EXISTING" | grep -q "$code"; then
    echo "[SKIP] Issue already exists: $title"
    return
  fi

  local args=(--title "$title" --body "$body")
  if [ -n "$label" ]; then
    gh label create "$label" --force 2>/dev/null || true
    args+=(--label "$label")
  fi

  local url
  url=$(gh issue create "${args[@]}")
  echo "[CREATED] $url"

  if [ "$should_close" = "close" ]; then
    gh issue close "$url" --comment "Completed and verified in MVP v2 (DoD met)."
    echo "[CLOSED] $url -> Done"
  fi
}

# --- LZ-7: Security & STRIDE ---
ensure_issue "EXP-18" \
  "EXP-18: SMS немесе Fingerprint арқылы анти-спам валидация (Spoofing)" \
  "**Role:** Backend (Санжар)\n**Release:** Инкремент 2\n**Size:** 5 SP\n**STRIDE:** Spoofing\n\n**Acceptance Criteria (GWT):**\n- **Given:** Пользователь оформляет заказ на стадионе\n- **When:** Поступает повторный спам-запрос с чужим номером\n- **Then:** Система требует SMS или Fingerprint валидацию." \
  "security" "open"

ensure_issue "EXP-19" \
  "EXP-19: API-де тапсырыс ID-сін тізбекті саннан UUID-ге ауыстыру" \
  "**Role:** Backend (Санжар)\n**Release:** Инкремент 1\n**Size:** 3 SP\n**STRIDE:** Information Disclosure\n\nРеализовано в backend/main.py через uuid.uuid4()." \
  "security" "close"

ensure_issue "EXP-20" \
  "EXP-20: Nginx деңгейінде Rate Limiting баптау (DoS қорғаныс)" \
  "**Role:** Backend (Санжар)\n**Release:** Инкремент 2\n**Size:** 5 SP\n**STRIDE:** Denial of Service (1 IP = 5 req/min)." \
  "security" "close"

# --- LZ-8: SLA, Monitoring & FinOps ---
ensure_issue "EXP-21" \
  "EXP-21: Uptime Kuma орнату (SLA мен қолжетімділікті мониторинг жасау үшін)" \
  "**Role:** Backend/DevOps\n**Release:** Инкремент 2\n**Size:** 3 SP\n\nМониторинг доступности /api/health (целевой SLA 99.5%)." \
  "devops" "close"

ensure_issue "EXP-22" \
  "EXP-22: PostgreSQL деректер қорын Hetzner VPS-ке орналастыру (Бюджет үнемдеу)" \
  "**Role:** Backend\n**Release:** Инкремент 1\n**Size:** 5 SP\n\nFinOps оптимизация TCO (78 000 KZT фактические затраты против 112 000 KZT плана)." \
  "finops" "close"

# --- LZ-11: UAT Bug Report & Postmortem Action Items ---
ensure_issue "BUG-01" \
  "BUG-01: Kaspi QR төлемнен кейін тапсырыс нөмірі экранға шықпайды" \
  "**Priority:** High\n**Owner:** Динара / Санжар\n**Release:** Инкремент 2\n\nИсправлено в MVP v2: бэкенд возвращает 5-значный pickup_code, UI отображает его сразу после оплаты." \
  "bug" "close"

ensure_issue "EXP-25" \
  "EXP-25: Мәзірді шығару эндпоинтіне Redis кэш қосу (Жүктемені азайту үшін)" \
  "**Postmortem Action Item #1**\n**Owner:** Санжар\n**Release:** Инкремент 3\n**Size:** 3 SP\n\nКэширование GET /api/menu в Redis для пиковой нагрузки в перерыве матча." \
  "performance" "open"

ensure_issue "EXP-26" \
  "EXP-26: PostgreSQL-де Connection Pooling (PgBouncer) орнату" \
  "**Postmortem Action Item #2**\n**Owner:** Санжар\n**Release:** Инкремент 3\n**Size:** 5 SP\n\nНастройка PgBouncer для стабильной работы под нагрузкой 5000 RPS." \
  "performance" "open"

ensure_issue "EXP-27" \
  "EXP-27: Жад (RAM) 80%-ға жеткенде Uptime Kuma арқылы Alert баптау" \
  "**Postmortem Action Item #3**\n**Owner:** Әділ (PM)\n**Release:** Инкремент 2\n**Size:** 2 SP\n\nНастроен алерт при превышении 80% RAM." \
  "devops" "close"

# --- LZ-12: AI Governance & Privacy ---
ensure_issue "EXP-28" \
  "EXP-28: Пікірлерді ИИ-ге жібермес бұрын мәтіннен дербес деректерді (телефон, аты-жөн) тазартатын скрипт жазу" \
  "**Role:** Backend\n**Release:** Инкремент 3\n**Size:** 3 SP\n\nРеализовано в backend/main.py (scrub_pii -> [PHONE_REDACTED], [EMAIL_REDACTED]) и покрыто pytest." \
  "ai-governance" "close"

# --- LZ-9: Close Sprint 1 & Sprint 2 baseline tasks ---
for code in EXP-1 EXP-2 EXP-3 EXP-7 EXP-10; do
  NUM=$(gh issue list --state open --search "$code in:title" --json number -q '.[0].number' 2>/dev/null || true)
  if [ -n "$NUM" ]; then
    gh issue close "$NUM" --comment "Completed in Sprint 1/2 (LZ-9 Throughput sync)."
    echo "[CLOSED] #$NUM ($code)"
  fi
done

echo "Done! Check 'gh project list' to attach items to your GitHub Project board."
