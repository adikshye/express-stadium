import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import {
  AuditLogEntry,
  calculateOrderItemsAndTotal,
  canTransitionOrderStatus,
  classifyReview,
  generatePickupCode,
  MENU_ITEMS,
  OrderItemInput,
  OrderRecord,
  OrderStatus,
  ReviewRecord,
  runMonteCarloSimulation,
  scrubPii,
  TRACKED_ISSUES,
  WIP_LIMIT,
} from './src/lib/expressLogic';

const ROOT_DIR = process.cwd();
const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

// Seed realistic initial stadium match orders so Seller Kanban starts populated (2/3 WIP)
const nowIso = () => new Date().toISOString();
let auditSeq = 1;

const orders: OrderRecord[] = [
  {
    id: crypto.randomUUID(),
    pickup_code: '48291',
    sector: 'Сектор A',
    seat: 'Ряд 8, Место 14',
    items: [
      {
        menu_item_id: 1,
        name: MENU_ITEMS[0].name,
        unit_price_kzt: MENU_ITEMS[0].price_kzt,
        quantity: 2,
        subtotal_kzt: 4800,
      },
      {
        menu_item_id: 5,
        name: MENU_ITEMS[4].name,
        unit_price_kzt: MENU_ITEMS[4].price_kzt,
        quantity: 2,
        subtotal_kzt: 1700,
      },
    ],
    total_kzt: 6500,
    payment_method: 'Kaspi QR',
    status: 'in_progress',
    created_at: new Date(Date.now() - 8 * 60_000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  },
  {
    id: crypto.randomUUID(),
    pickup_code: '73904',
    sector: 'Сектор C',
    seat: 'Ряд 3, Место 22',
    items: [
      {
        menu_item_id: 3,
        name: MENU_ITEMS[2].name,
        unit_price_kzt: MENU_ITEMS[2].price_kzt,
        quantity: 1,
        subtotal_kzt: 2900,
      },
    ],
    total_kzt: 2900,
    payment_method: 'Kaspi QR',
    status: 'in_progress',
    created_at: new Date(Date.now() - 6 * 60_000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 60_000).toISOString(),
  },
  {
    id: crypto.randomUUID(),
    pickup_code: '51820',
    sector: 'Сектор B',
    seat: 'Ряд 11, Место 7',
    items: [
      {
        menu_item_id: 2,
        name: MENU_ITEMS[1].name,
        unit_price_kzt: MENU_ITEMS[1].price_kzt,
        quantity: 2,
        subtotal_kzt: 3000,
      },
    ],
    total_kzt: 3000,
    payment_method: 'Kaspi QR',
    status: 'new',
    created_at: new Date(Date.now() - 2 * 60_000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 60_000).toISOString(),
  },
  {
    id: crypto.randomUUID(),
    pickup_code: '19402',
    sector: 'Сектор A',
    seat: 'Ряд 2, Место 3',
    items: [
      {
        menu_item_id: 4,
        name: MENU_ITEMS[3].name,
        unit_price_kzt: MENU_ITEMS[3].price_kzt,
        quantity: 1,
        subtotal_kzt: 3400,
      },
    ],
    total_kzt: 3400,
    payment_method: 'Kaspi QR',
    status: 'ready',
    created_at: new Date(Date.now() - 14 * 60_000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 60_000).toISOString(),
  },
];

const auditLogs: AuditLogEntry[] = orders.map((order) => ({
  id: auditSeq++,
  order_id: order.id,
  pickup_code: order.pickup_code,
  action: 'ORDER_CREATED',
  actor: 'guest_checkout',
  details: `Заказ #${order.pickup_code} на ${order.total_kzt.toLocaleString('ru-RU')} ₸ (${order.payment_method})`,
  created_at: order.created_at,
}));

const reviews: ReviewRecord[] = [
  {
    id: crypto.randomUUID(),
    order_code: '19402',
    redacted_text: 'Забрал комбо за 30 секунд без очереди! Горячий бургер, отличная идея для арены.',
    pii_masked: false,
    ai_category: 'Food Quality',
    confidence: 0.94,
    created_at: new Date(Date.now() - 18 * 60_000).toISOString(),
  },
  {
    id: crypto.randomUUID(),
    order_code: '48291',
    redacted_text: 'Оплата через Kaspi QR прошла с задержкой, мой номер [PHONE_REDACTED] для возврата чека.',
    pii_masked: true,
    ai_category: 'Payment Issue',
    confidence: 0.95,
    created_at: new Date(Date.now() - 12 * 60_000).toISOString(),
  },
  {
    id: crypto.randomUUID(),
    order_code: '73904',
    redacted_text: 'Кассир на стойке сектора C очень вежливо и быстро выдал заказ.',
    pii_masked: false,
    ai_category: 'Staff',
    confidence: 0.91,
    created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  },
];

function safeReadText(relPath: string): string {
  try {
    return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf-8');
  } catch {
    return '';
  }
}

function parseEvalCsv(csvText: string) {
  const lines = csvText.trim().split('\n').slice(1);
  return lines
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+),"(.*)",([^,]+),([^,]+),([^,]+)$/);
      if (!match) return null;
      return {
        id: Number(match[1]),
        text: match[2],
        expected_category: match[3].trim(),
        ai_predicted: match[4].trim(),
        result: match[5].trim() as 'Pass' | 'Fail',
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Serve docs PNG artifacts and standalone static MVP files
  app.use('/docs', express.static(path.join(ROOT_DIR, 'docs')));
  app.use('/static', express.static(path.join(ROOT_DIR, 'frontend')));
  app.use('/frontend', express.static(path.join(ROOT_DIR, 'frontend')));

  // --- API Routes (1:1 parity with backend/main.py) ---
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'express-stadium-server',
      database: 'in-memory-sqlite-parity',
      wip_limit: WIP_LIMIT,
      timestamp: nowIso(),
    });
  });

  app.get('/api/menu', (_req, res) => {
    res.json(MENU_ITEMS);
  });

  app.get('/api/orders', (_req, res) => {
    const wipCount = orders.filter((o) => o.status === 'in_progress').length;
    res.json({
      orders,
      wip_count: wipCount,
      wip_limit: WIP_LIMIT,
    });
  });

  app.post('/api/orders', (req, res) => {
    try {
      const sector = String(req.body?.sector ?? '').trim();
      const seat = String(req.body?.seat ?? '').trim();
      const paymentMethod = String(req.body?.payment_method ?? 'Kaspi QR').trim() || 'Kaspi QR';
      const rawItems = Array.isArray(req.body?.items) ? (req.body.items as OrderItemInput[]) : [];

      if (!sector || !seat) {
        res.status(400).json({ detail: 'Укажите сектор и место на стадионе.' });
        return;
      }

      const { items, totalKzt } = calculateOrderItemsAndTotal(rawItems);
      const now = nowIso();
      const order: OrderRecord = {
        id: crypto.randomUUID(),
        pickup_code: generatePickupCode(),
        sector,
        seat,
        items,
        total_kzt: totalKzt,
        payment_method: paymentMethod,
        status: 'new',
        created_at: now,
        updated_at: now,
      };

      orders.unshift(order);
      auditLogs.unshift({
        id: auditSeq++,
        order_id: order.id,
        pickup_code: order.pickup_code,
        action: 'ORDER_CREATED',
        actor: 'guest_checkout',
        details: `Заказ #${order.pickup_code} на ${order.total_kzt.toLocaleString('ru-RU')} ₸ (${order.payment_method})`,
        created_at: now,
      });

      res.status(201).json(order);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка оформления заказа';
      res.status(400).json({ detail: message });
    }
  });

  app.patch('/api/orders/:orderId/status', (req, res) => {
    const { orderId } = req.params;
    const nextStatus = req.body?.status as OrderStatus;
    const actor = String(req.body?.actor ?? 'seller_kanban');

    const check = canTransitionOrderStatus(orders, orderId, nextStatus, WIP_LIMIT);
    if (!check.ok) {
      res.status(check.code).json({ detail: check.reason });
      return;
    }

    const order = orders.find((o) => o.id === orderId)!;
    const prevStatus = order.status;
    order.status = nextStatus;
    order.updated_at = nowIso();

    auditLogs.unshift({
      id: auditSeq++,
      order_id: order.id,
      pickup_code: order.pickup_code,
      action: 'STATUS_CHANGED',
      actor,
      details: `#${order.pickup_code}: ${prevStatus} → ${nextStatus}`,
      created_at: order.updated_at,
    });

    res.json(order);
  });

  app.get('/api/audit', (_req, res) => {
    res.json(auditLogs.slice(0, 30));
  });

  app.get('/api/reviews', (_req, res) => {
    res.json(reviews);
  });

  app.post('/api/reviews', (req, res) => {
    const rawText = String(req.body?.text ?? '').trim();
    const orderCode = req.body?.order_code ? String(req.body.order_code).trim() : null;
    if (rawText.length < 3) {
      res.status(400).json({ detail: 'Текст отзыва должен содержать минимум 3 символа.' });
      return;
    }

    const { redactedText, piiMasked } = scrubPii(rawText);
    const { category, confidence } = classifyReview(redactedText);
    const created: ReviewRecord = {
      id: crypto.randomUUID(),
      order_code: orderCode,
      redacted_text: redactedText,
      pii_masked: piiMasked,
      ai_category: category,
      confidence,
      created_at: nowIso(),
    };
    reviews.unshift(created);
    res.status(201).json(created);
  });

  app.get('/api/artifacts', (_req, res) => {
    let threatModel = null;
    try {
      threatModel = JSON.parse(safeReadText('docs/security/threat-model.json'));
    } catch {
      threatModel = null;
    }
    const evalRows = parseEvalCsv(safeReadText('docs/ai/eval_dataset.csv'));
    const passCount = evalRows.filter((r) => r.result === 'Pass').length;

    res.json({
      threatModel,
      evals: {
        total: evalRows.length,
        passCount,
        failCount: evalRows.length - passCount,
        accuracyPct: evalRows.length ? Math.round((passCount / evalRows.length) * 100) : 0,
        rows: evalRows,
      },
      monteCarlo: runMonteCarloSimulation(42, 10000),
      latestAiReport: safeReadText('docs/latest_ai_status_report.md'),
      adr001: safeReadText('docs/adr/0001-model-postavki.md'),
      adr002: safeReadText('docs/adr/ADR-002-ai-classifier.md'),
      issues: TRACKED_ISSUES,
      charts: {
        monteCarloPng: '/docs/simulation/monte_carlo_histogram.png',
        doraPng: '/docs/dora_dashboard.png',
        executivePng: '/docs/project_dashboard.png',
      },
    });
  });

  // Deterministic SVG chart renderers for generating docs/*.png artifacts
  app.get('/render-chart/:kind', (req, res) => {
    const kind = req.params.kind;
    if (kind === 'monte-carlo') {
      const sim = runMonteCarloSimulation(42, 10000);
      const maxCount = Math.max(...sim.histogram.map((b) => b.count), 1);
      const W = 1000;
      const H = 520;
      const padL = 78;
      const padR = 36;
      const padT = 62;
      const padB = 64;
      const plotW = W - padL - padR;
      const plotH = H - padT - padB;
      const barW = plotW / sim.histogram.length;
      const yTicks = [0, 500, 1000, 1500, 2000, 2500].filter((t) => t <= maxCount * 1.15);

      const bars = sim.histogram
        .map((b, idx) => {
          const bh = (b.count / (maxCount * 1.12)) * plotH;
          const x = padL + idx * barW + 2;
          const y = padT + plotH - bh;
          return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(4, barW - 4).toFixed(1)}" height="${bh.toFixed(1)}" fill="#4682B4" stroke="#111827" stroke-width="1.2" />
            <text x="${(x + barW / 2 - 2).toFixed(1)}" y="${padT + plotH + 20}" text-anchor="middle" font-size="12" fill="#374151">${b.week}</text>`;
        })
        .join('');

      const xForWeek = (w: number) => {
        const idx = sim.histogram.findIndex((b) => b.week === w);
        return padL + (idx >= 0 ? idx + 0.5 : 0) * barW;
      };
      const x50 = xForWeek(sim.p50);
      const x85 = xForWeek(sim.p85);

      const gridLines = yTicks
        .map((t) => {
          const y = padT + plotH - (t / (maxCount * 1.12)) * plotH;
          return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="#D1D5DB" stroke-dasharray="3,3" />
            <text x="${padL - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="12" fill="#374151">${t}</text>`;
        })
        .join('');

      res.type('html').send(`<!doctype html><html><body style="margin:0;background:#fff;display:flex;justify-content:center;align-items:center;font-family:sans-serif">
        <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${W}" height="${H}" fill="#ffffff"/>
          <text x="${W / 2}" y="34" text-anchor="middle" font-size="18" font-weight="700" fill="#111827">Мерзімдерді ықтималдықпен болжау (10 000 прогон) - "Express" жобасы</text>
          ${gridLines}
          <rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="none" stroke="#111827" stroke-width="1.2"/>
          ${bars}
          <line x1="${x50.toFixed(1)}" y1="${padT}" x2="${x50.toFixed(1)}" y2="${padT + plotH}" stroke="#DC2626" stroke-width="2.5" stroke-dasharray="8,5"/>
          <line x1="${x85.toFixed(1)}" y1="${padT}" x2="${x85.toFixed(1)}" y2="${padT + plotH}" stroke="#16A34A" stroke-width="2.5" stroke-dasharray="8,5"/>
          <rect x="${W - padR - 210}" y="${padT + 14}" width="196" height="58" rx="6" fill="#ffffff" stroke="#D1D5DB"/>
          <line x1="${W - padR - 196}" y1="${padT + 34}" x2="${W - padR - 166}" y2="${padT + 34}" stroke="#DC2626" stroke-width="2.5" stroke-dasharray="6,4"/>
          <text x="${W - padR - 158}" y="${padT + 38}" font-size="13" font-weight="600" fill="#111827">P50 (${sim.p50} апта)</text>
          <line x1="${W - padR - 196}" y1="${padT + 56}" x2="${W - padR - 166}" y2="${padT + 56}" stroke="#16A34A" stroke-width="2.5" stroke-dasharray="6,4"/>
          <text x="${W - padR - 158}" y="${padT + 60}" font-size="13" font-weight="600" fill="#111827">P85 (${sim.p85} апта)</text>
          <text x="${W / 2}" y="${H - 16}" text-anchor="middle" font-size="14" font-weight="600" fill="#111827">Аяқтауға қажетті апта саны</text>
          <text x="22" y="${padT + plotH / 2}" text-anchor="middle" font-size="14" font-weight="600" fill="#111827" transform="rotate(-90 22 ${padT + plotH / 2})">Прогондар саны</text>
        </svg>
      </body></html>`);
      return;
    }

    if (kind === 'dora') {
      const panels = [
        { title: 'Deploy Frequency (per week)', current: 2, target: 5, color: '#3498db' },
        { title: 'Lead Time (days)', current: 4.5, target: 2, color: '#e67e22' },
        { title: 'Change Failure Rate (%)', current: 15, target: 5, color: '#e74c3c' },
        { title: 'Time to Restore (hours)', current: 2.5, target: 1, color: '#2ecc71' },
      ];
      const W = 1040;
      const H = 680;
      const cards = panels
        .map((p, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const ox = 50 + col * 490;
          const oy = 76 + row * 295;
          const pw = 450;
          const ph = 240;
          const maxV = Math.max(p.current, p.target) * 1.3;
          const h1 = (p.current / maxV) * 165;
          const h2 = (p.target / maxV) * 165;
          return `<g transform="translate(${ox},${oy})">
            <text x="${pw / 2}" y="22" text-anchor="middle" font-size="15" font-weight="700" fill="#111827">${p.title}</text>
            <rect x="40" y="34" width="${pw - 60}" height="180" fill="#ffffff" stroke="#CBD5E1"/>
            <rect x="105" y="${214 - h1}" width="92" height="${h1}" fill="${p.color}"/>
            <text x="151" y="${206 - h1}" text-anchor="middle" font-size="14" font-weight="700" fill="#111827">${p.current}</text>
            <text x="151" y="234" text-anchor="middle" font-size="13" fill="#374151">Current</text>
            <rect x="265" y="${214 - h2}" width="92" height="${h2}" fill="#bdc3c7"/>
            <text x="311" y="${206 - h2}" text-anchor="middle" font-size="14" font-weight="700" fill="#111827">${p.target}</text>
            <text x="311" y="234" text-anchor="middle" font-size="13" fill="#374151">Target</text>
          </g>`;
        })
        .join('');

      res.type('html').send(`<!doctype html><html><body style="margin:0;background:#fff;font-family:sans-serif">
        <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${W}" height="${H}" fill="#ffffff"/>
          <text x="${W / 2}" y="42" text-anchor="middle" font-size="22" font-weight="700" fill="#111827">DORA Metrics Dashboard - "Express" Project (LZ-10)</text>
          ${cards}
        </svg>
      </body></html>`);
      return;
    }

    if (kind === 'executive') {
      const W = 1120;
      const H = 460;
      // 29/42 = 69.05%, 13/42 = 30.95%
      const r = 108;
      const cx = 190;
      const cy = 248;
      const angle = (29 / 42) * 2 * Math.PI;
      const xEnd = cx + r * Math.sin(angle);
      const yEnd = cy - r * Math.cos(angle);
      const maxBudget = 130000;
      const hPlan = (112000 / maxBudget) * 220;
      const hAct = (78000 / maxBudget) * 220;

      res.type('html').send(`<!doctype html><html><body style="margin:0;background:#fff;font-family:sans-serif">
        <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${W}" height="${H}" fill="#ffffff"/>
          <text x="${W / 2}" y="40" text-anchor="middle" font-size="22" font-weight="700" fill="#111827">"Express" Project Executive Dashboard (LZ-14)</text>

          <text x="190" y="92" text-anchor="middle" font-size="15" font-weight="700" fill="#111827">Sprint Progress (29/42 tasks)</text>
          <path d="M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${xEnd.toFixed(1)} ${yEnd.toFixed(1)} Z" fill="#2ecc71" stroke="#fff" stroke-width="2"/>
          <path d="M ${cx} ${cy} L ${xEnd.toFixed(1)} ${yEnd.toFixed(1)} A ${r} ${r} 0 0 1 ${cx} ${cy - r} Z" fill="#e74c3c" stroke="#fff" stroke-width="2"/>
          <text x="${cx + 42}" y="${cy + 36}" text-anchor="middle" font-size="14" font-weight="700" fill="#ffffff">69.0%</text>
          <text x="${cx - 46}" y="${cy - 34}" text-anchor="middle" font-size="14" font-weight="700" fill="#ffffff">31.0%</text>
          <text x="190" y="392" text-anchor="middle" font-size="13" fill="#111827">Done (70%) / Remaining (30%)</text>

          <text x="565" y="92" text-anchor="middle" font-size="15" font-weight="700" fill="#111827">Annual Budget (KZT)</text>
          <rect x="415" y="114" width="300" height="240" fill="#ffffff" stroke="#CBD5E1"/>
          <rect x="465" y="${354 - hPlan}" width="80" height="${hPlan}" fill="#3498db"/>
          <text x="505" y="${346 - hPlan}" text-anchor="middle" font-size="13" font-weight="700" fill="#111827">112 000</text>
          <text x="505" y="376" text-anchor="middle" font-size="13" fill="#374151">Planned TCO</text>
          <rect x="585" y="${354 - hAct}" width="80" height="${hAct}" fill="#9b59b6"/>
          <text x="625" y="${346 - hAct}" text-anchor="middle" font-size="13" font-weight="700" fill="#111827">78 000</text>
          <text x="625" y="376" text-anchor="middle" font-size="13" fill="#374151">Actual Spend</text>

          <text x="930" y="92" text-anchor="middle" font-size="15" font-weight="700" fill="#111827">Flow &amp; DORA Metrics</text>
          <rect x="780" y="114" width="300" height="240" rx="8" fill="#F8FAFC" stroke="#E2E8F0"/>
          <text x="802" y="160" font-size="15" fill="#111827">Cycle Time (avg): 2.1 days</text>
          <text x="802" y="198" font-size="15" fill="#111827">Throughput: 7 tasks / sprint</text>
          <text x="802" y="236" font-size="15" fill="#111827">Deploy Freq: 2 / week</text>
          <text x="802" y="274" font-size="15" fill="#111827">Change Failure Rate: 15%</text>
          <text x="802" y="322" font-size="15" font-weight="700" fill="#d35400">Status: YELLOW (Scope reduced)</text>
        </svg>
      </body></html>`);
      return;
    }

    res.status(404).send('Unknown chart');
  });

  // Standalone seller route compatibility
  app.get('/seller.html', (_req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'frontend', 'seller.html'));
  });

  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express Stadium server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
