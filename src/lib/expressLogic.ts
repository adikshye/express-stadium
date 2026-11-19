export type OrderStatus = 'new' | 'in_progress' | 'ready' | 'completed';

export type ReviewCategory = 'Food Quality' | 'Payment Issue' | 'App Bug' | 'Staff';

export interface MenuItem {
  id: number;
  name: string;
  category: 'Бургеры' | 'Закуски' | 'Комбо' | 'Напитки';
  description: string;
  price_kzt: number;
  prep_minutes: number;
  available: boolean;
  image_url: string;
  tag?: string;
}

export interface OrderItemInput {
  menu_item_id: number;
  quantity: number;
}

export interface ResolvedOrderItem {
  menu_item_id: number;
  name: string;
  unit_price_kzt: number;
  quantity: number;
  subtotal_kzt: number;
}

export interface OrderRecord {
  id: string;
  pickup_code: string;
  sector: string;
  seat: string;
  items: ResolvedOrderItem[];
  total_kzt: number;
  payment_method: string;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: number;
  order_id: string;
  pickup_code: string;
  action: 'ORDER_CREATED' | 'STATUS_CHANGED';
  actor: string;
  details: string;
  created_at: string;
}

export interface ReviewRecord {
  id: string;
  order_code: string | null;
  redacted_text: string;
  pii_masked: boolean;
  ai_category: ReviewCategory;
  confidence: number;
  created_at: string;
}

export interface MonteCarloSummary {
  runs: number;
  backlog: number;
  p50: number;
  p70: number;
  p85: number;
  p95: number;
  histogram: Array<{ week: number; count: number }>;
}

export const WIP_LIMIT = 3;

export const HERO_IMAGE_URL = '/src/assets/images/stadium_hero_food_1795088272619.jpg';

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 1,
    name: 'Express Smash Бургер',
    category: 'Бургеры',
    description: 'Двойная говяжья котлета, выдержанный чеддер, маринованные огурцы и фирменный соус в бриоши.',
    price_kzt: 2400,
    prep_minutes: 6,
    available: true,
    image_url: '/src/assets/images/menu_burger_classic_1795088273394.jpg',
    tag: 'Хит матча',
  },
  {
    id: 2,
    name: 'Стадионный Гриль Хот-дог',
    category: 'Закуски',
    description: 'Говяжья сосиска на гриле, карамелизованный лук, хрустящий шалот и зернистая горчица.',
    price_kzt: 1500,
    prep_minutes: 4,
    available: true,
    image_url: '/src/assets/images/menu_hotdog_grill_1795088273348.jpg',
    tag: 'Быстрая выдача',
  },
  {
    id: 3,
    name: 'Крылышки BBQ + Картофель Фри',
    category: 'Комбо',
    description: 'Глазированные крылышки BBQ, хрустящий картофель фри и сливочно-чесночный дип в лотке.',
    price_kzt: 2900,
    prep_minutes: 7,
    available: true,
    image_url: '/src/assets/images/menu_wings_fries_1795088272274.jpg',
    tag: 'Для компании',
  },
  {
    id: 4,
    name: 'Комбо Болельщика',
    category: 'Комбо',
    description: 'Express Smash Бургер, порция золотистого картофеля фри и охлажденный напиток 0.5 л.',
    price_kzt: 3400,
    prep_minutes: 7,
    available: true,
    image_url: '/src/assets/images/menu_burger_classic_1795088273394.jpg',
    tag: 'Выгода 450 ₸',
  },
  {
    id: 5,
    name: 'Ягодный Лимонад / Кола 0.5л',
    category: 'Напитки',
    description: 'Охлажденный газированный напиток со льдом и долькой лимона в герметичном стадионом стакане.',
    price_kzt: 850,
    prep_minutes: 2,
    available: true,
    image_url: '/src/assets/images/menu_drinks_combo_1795088273761.jpg',
  },
  {
    id: 6,
    name: 'Картофель Фри XL',
    category: 'Закуски',
    description: 'Хрустящий картофель с морской солью и специями в удобном картонном лотке для трибун.',
    price_kzt: 1100,
    prep_minutes: 4,
    available: true,
    image_url: '/src/assets/images/menu_wings_fries_1795088272274.jpg',
  },
];

const PHONE_REGEX = /(?:\+7|8|7)[\s\-()]*(?:\d[\s\-()]*){10}|\b\d{3}[\s\-]\d{3}[\s\-]\d{2}[\s\-]\d{2}\b/g;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;

export function scrubPii(rawText: string): { redactedText: string; piiMasked: boolean } {
  const phoneScrubbed = rawText.replace(PHONE_REGEX, '[PHONE_REDACTED]');
  const emailScrubbed = phoneScrubbed.replace(EMAIL_REGEX, '[EMAIL_REDACTED]');
  return {
    redactedText: emailScrubbed,
    piiMasked: emailScrubbed !== rawText,
  };
}

export function classifyReview(cleanText: string): { category: ReviewCategory; confidence: number } {
  const lower = cleanText.toLowerCase();
  const paymentKw = [
    'kaspi', 'каспи', 'оплат', 'чек', 'төлем', 'списал', 'qr', 'кьюар',
    'деньг', 'возврат', 'ақша', 'банк', 'терминал', 'payment', 'комисс',
  ];
  const bugKw = [
    'баг', 'ошибк', 'завис', 'не открыв', 'экран', 'код не', 'қате',
    'кнопк', 'приложен', 'сайт', 'тормоз', 'вылет', 'bug', 'crash', 'загруз', 'таймер', 'не работа',
  ];
  const staffKw = [
    'кассир', 'продав', 'персонал', 'груб', 'вежлив', 'очеред', 'сатушы',
    'қызметкер', 'выдач', 'хам', 'обслужив', 'staff', 'сотрудник',
  ];

  const scores: Array<{ category: ReviewCategory; score: number; confidence: number }> = [
    { category: 'App Bug', score: bugKw.filter((k) => lower.includes(k)).length, confidence: 0.91 },
    { category: 'Payment Issue', score: paymentKw.filter((k) => lower.includes(k)).length, confidence: 0.94 },
    { category: 'Staff', score: staffKw.filter((k) => lower.includes(k)).length, confidence: 0.89 },
  ];

  scores.sort((a, b) => b.score - a.score);
  if (scores[0].score > 0) {
    return { category: scores[0].category, confidence: scores[0].confidence };
  }
  return { category: 'Food Quality', confidence: 0.92 };
}

export function calculateOrderItemsAndTotal(
  inputs: OrderItemInput[],
  catalog: MenuItem[] = MENU_ITEMS
): { items: ResolvedOrderItem[]; totalKzt: number } {
  if (!inputs.length) {
    throw new Error('Order must contain at least one item');
  }
  const byId = new Map<number, MenuItem>(catalog.map((m) => [m.id, m]));
  const items: ResolvedOrderItem[] = [];
  let totalKzt = 0;

  for (const entry of inputs) {
    if (!Number.isInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > 20) {
      throw new Error(`Invalid quantity for menu item ${entry.menu_item_id}`);
    }
    const found = byId.get(entry.menu_item_id);
    if (!found) {
      throw new Error(`Menu item ${entry.menu_item_id} not found`);
    }
    const subtotal = found.price_kzt * entry.quantity;
    totalKzt += subtotal;
    items.push({
      menu_item_id: found.id,
      name: found.name,
      unit_price_kzt: found.price_kzt,
      quantity: entry.quantity,
      subtotal_kzt: subtotal,
    });
  }

  return { items, totalKzt };
}

export function canTransitionOrderStatus(
  orders: OrderRecord[],
  orderId: string,
  nextStatus: OrderStatus,
  wipLimit: number = WIP_LIMIT
): { ok: true } | { ok: false; code: number; reason: string } {
  const allowed: OrderStatus[] = ['new', 'in_progress', 'ready', 'completed'];
  if (!allowed.includes(nextStatus)) {
    return { ok: false, code: 400, reason: `Некорректный статус: ${nextStatus}` };
  }
  const target = orders.find((o) => o.id === orderId);
  if (!target) {
    return { ok: false, code: 404, reason: 'Заказ не найден' };
  }
  if (nextStatus === 'in_progress' && target.status !== 'in_progress') {
    const activeCount = orders.filter((o) => o.status === 'in_progress').length;
    if (activeCount >= wipLimit) {
      return {
        ok: false,
        code: 409,
        reason: `Превышен WIP-лимит (макс. ${wipLimit} заказа в работе одновременно по ADR-001). Сначала завершите текущий заказ.`,
      };
    }
  }
  return { ok: true };
}

export function generatePickupCode(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}

export function runMonteCarloSimulation(backlog = 42, runs = 10000): MonteCarloSummary {
  const history = [4, 6, 0, 7, 5, 2, 6, 9, 4, 5, 0, 6, 7, 4, 5, 1, 6, 5, 9, 3, 4, 6, 5, 8, 2, 5];
  // Deterministic Mulberry32 PRNG seeded with 42
  let state = 42;
  const rand = () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const weeks: number[] = new Array(runs);
  const counts = new Map<number, number>();
  let minW = Infinity;
  let maxW = -Infinity;

  for (let i = 0; i < runs; i += 1) {
    let done = 0;
    let w = 0;
    while (done < backlog) {
      done += history[Math.floor(rand() * history.length)];
      w += 1;
    }
    weeks[i] = w;
    if (w < minW) minW = w;
    if (w > maxW) maxW = w;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }

  weeks.sort((a, b) => a - b);
  const percentile = (p: number) => weeks[Math.min(runs - 1, Math.floor((p / 100) * (runs - 1)))];

  const histogram: Array<{ week: number; count: number }> = [];
  for (let w = minW; w <= maxW; w += 1) {
    histogram.push({ week: w, count: counts.get(w) ?? 0 });
  }

  return {
    runs,
    backlog,
    p50: percentile(50),
    p70: percentile(70),
    p85: percentile(85),
    p95: percentile(95),
    histogram,
  };
}

export interface TrackedIssue {
  key: string;
  title: string;
  role: string;
  release: string;
  size: string;
  column: 'Done' | 'In Progress (WIP: 3)' | 'Review / QA (WIP: 2)' | 'To Do';
  lab: string;
}

export const TRACKED_ISSUES: TrackedIssue[] = [
  { key: 'EXP-18', title: 'SMS немесе Fingerprint арқылы анти-спам валидация (Spoofing)', role: 'Backend (Санжар)', release: 'Инкремент 2', size: '5 SP', column: 'In Progress (WIP: 3)', lab: 'ЛЗ-7' },
  { key: 'EXP-19', title: 'API-де тапсырыс ID-сін тізбекті саннан UUID-ге ауыстыру', role: 'Backend (Санжар)', release: 'Инкремент 1', size: '3 SP', column: 'Done', lab: 'ЛЗ-7' },
  { key: 'EXP-20', title: 'Nginx деңгейінде Rate Limiting баптау (DoS қорғаныс)', role: 'Backend (Санжар)', release: 'Инкремент 2', size: '5 SP', column: 'Done', lab: 'ЛЗ-7' },
  { key: 'EXP-21', title: 'Uptime Kuma орнату (SLA мен қолжетімділікті мониторинг жасау)', role: 'Backend/DevOps', release: 'Инкремент 2', size: '3 SP', column: 'Done', lab: 'ЛЗ-8' },
  { key: 'EXP-22', title: 'PostgreSQL деректер қорын Hetzner VPS-ке орналастыру', role: 'Backend', release: 'Инкремент 1', size: '5 SP', column: 'Done', lab: 'ЛЗ-8' },
  { key: 'BUG-01', title: 'Kaspi QR төлемнен кейін тапсырыс нөмірі экранға шықпайды', role: 'Динара / Санжар', release: 'Инкремент 2', size: 'High', column: 'Done', lab: 'ЛЗ-11' },
  { key: 'EXP-25', title: 'Мәзірді шығару эндпоинтіне Redis кэш қосу', role: 'Санжар', release: 'Инкремент 3', size: '3 SP', column: 'To Do', lab: 'ЛЗ-11' },
  { key: 'EXP-26', title: 'PostgreSQL-де Connection Pooling (PgBouncer) орнату', role: 'Санжар', release: 'Инкремент 3', size: '5 SP', column: 'To Do', lab: 'ЛЗ-11' },
  { key: 'EXP-27', title: 'Жад (RAM) 80%-ға жеткенде Uptime Kuma арқылы Alert баптау', role: 'Әділ (PM)', release: 'Инкремент 2', size: '2 SP', column: 'Done', lab: 'ЛЗ-11' },
  { key: 'EXP-28', title: 'Пікірлерді ИИ-ге жібермес бұрын ПДн тазартатын скрипт жазу', role: 'Backend', release: 'Инкремент 3', size: '3 SP', column: 'Done', lab: 'ЛЗ-12' },
  { key: 'EXP-1', title: 'QR және Мәзір витринасы (Спринт 1)', role: 'Front (Динара)', release: 'Инкремент 1', size: '5 SP', column: 'Done', lab: 'ЛЗ-9' },
  { key: 'EXP-10', title: 'Өзгертілмейтін Аудит журналы (Repudiation)', role: 'Backend (Санжар)', release: 'Инкремент 1', size: '3 SP', column: 'Done', lab: 'ЛЗ-9' },
];
