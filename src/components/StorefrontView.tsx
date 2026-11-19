import React, { useMemo, useState } from 'react';
import { Check, Minus, Plus, QrCode, Trash2, UtensilsCrossed } from 'lucide-react';
import { HERO_IMAGE_URL, MenuItem, OrderRecord } from '../lib/expressLogic';

export interface CartEntry {
  menu_item_id: number;
  quantity: number;
}

interface StorefrontViewProps {
  menu: MenuItem[];
  cart: CartEntry[];
  recentOrders: OrderRecord[];
  onAddToCart: (menuItemId: number) => void;
  onUpdateQty: (menuItemId: number, delta: number) => void;
  onRemoveFromCart: (menuItemId: number) => void;
  onOrderCreated: (order: OrderRecord) => void;
  onOpenSeller: () => void;
}

const CATEGORIES = ['Все', 'Бургеры', 'Комбо', 'Закуски', 'Напитки'] as const;

const STATUS_LABELS: Record<OrderRecord['status'], string> = {
  new: 'Принят',
  in_progress: 'Готовится',
  ready: 'Готов к выдаче',
  completed: 'Выдан',
};

export const StorefrontView: React.FC<StorefrontViewProps> = ({
  menu,
  cart,
  recentOrders,
  onAddToCart,
  onUpdateQty,
  onRemoveFromCart,
  onOrderCreated,
  onOpenSeller,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<(typeof CATEGORIES)[number]>('Все');
  const [sector, setSector] = useState('');
  const [seat, setSeat] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [showKaspiModal, setShowKaspiModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [latestOrder, setLatestOrder] = useState<OrderRecord | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const filteredMenu = useMemo(() => {
    if (selectedCategory === 'Все') return menu;
    return menu.filter((item) => item.category === selectedCategory);
  }, [menu, selectedCategory]);

  const cartDetails = useMemo(() => {
    const byId = new Map(menu.map((m) => [m.id, m]));
    return cart
      .map((entry) => {
        const item = byId.get(entry.menu_item_id);
        if (!item) return null;
        return {
          ...entry,
          item,
          subtotal: item.price_kzt * entry.quantity,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [cart, menu]);

  const cartTotal = useMemo(
    () => cartDetails.reduce((sum, entry) => sum + entry.subtotal, 0),
    [cartDetails]
  );

  const qtyByItem = useMemo(() => {
    const map = new Map<number, number>();
    for (const c of cart) map.set(c.menu_item_id, c.quantity);
    return map;
  }, [cart]);

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (cartDetails.length === 0) {
      setFormError('Добавьте хотя бы одно блюдо в корзину перед оплатой.');
      return;
    }
    if (!sector.trim() || !seat.trim()) {
      setFormError('Заполните поля «Сектор» и «Ряд и место».');
      return;
    }
    setShowKaspiModal(true);
  };

  const handleConfirmKaspiPayment = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sector: sector.trim(),
          seat: seat.trim(),
          items: cart,
          payment_method: 'Kaspi QR',
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setFormError(data.detail || 'Не удалось оформить заказ.');
        setShowKaspiModal(false);
        return;
      }
      setLatestOrder(data);
      setShowKaspiModal(false);
      setSector('');
      setSeat('');
      onOrderCreated(data);
    } catch {
      setFormError('Ошибка сети при оформлении заказа. Повторите попытку.');
      setShowKaspiModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-12">
      {/* Storefront Hero: Balanced 2-Column Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="lg:col-span-6 p-8 sm:p-10 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <p className="text-xs font-medium text-neutral-500">
              Стадионный фуд-корт · Секторы A–D · Выдача без очереди
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight text-neutral-950 leading-[1.12] [text-wrap:balance]">
              Еда на стадионе без очередей в перерыве
            </h1>
            <p className="text-base text-neutral-600 leading-relaxed max-w-xl">
              Выберите блюда прямо с трибуны, оплатите через Kaspi QR и получите
              5-значный код выдачи. Забирайте горячий заказ на стойке Express за 30 секунд.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <a
              href="#menu-section"
              className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap shrink-0"
            >
              Выбрать блюда
            </a>
            <button
              type="button"
              onClick={onOpenSeller}
              className="inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-neutral-800 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Доска продавца (WIP: 3)
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-6 border-t border-neutral-200">
            <div>
              <div className="font-mono text-base sm:text-lg font-bold text-neutral-950 tabular-nums whitespace-nowrap">
                4–7 мин
              </div>
              <div className="text-xs text-neutral-500">Средняя готовка</div>
            </div>
            <div>
              <div className="font-mono text-base sm:text-lg font-bold text-neutral-950 tabular-nums whitespace-nowrap">
                Kaspi QR
              </div>
              <div className="text-xs text-neutral-500">Мгновенная оплата</div>
            </div>
            <div>
              <div className="font-mono text-base sm:text-lg font-bold text-neutral-950 tabular-nums whitespace-nowrap">
                UUIDv4
              </div>
              <div className="text-xs text-neutral-500">Защищенный чек</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 min-h-[260px] lg:min-h-full bg-neutral-100 relative">
          {!failedImages[HERO_IMAGE_URL] ? (
            <img
              src={HERO_IMAGE_URL}
              alt="Поднос с бургером, картофелем фри и напитками на стадионе"
              referrerPolicy="no-referrer"
              onError={() => setFailedImages((prev) => ({ ...prev, [HERO_IMAGE_URL]: true }))}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-neutral-100 text-neutral-500 p-8">
              <UtensilsCrossed className="w-8 h-8" aria-hidden="true" />
              <span className="text-sm font-medium">Фуд-корт Express Stadium</span>
            </div>
          )}
        </div>
      </section>

      {/* Main Catalog + Sticky Checkout Panel */}
      <section id="menu-section" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-neutral-950 tracking-tight">
                Меню фуд-корта
              </h2>
              <p className="text-sm text-neutral-500 mt-1">
                Актуальные цены рассчитываются на сервере (защита от подмены Tampering).
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Категории меню"
              className="inline-flex items-center gap-1 p-1 bg-neutral-200/70 rounded-lg overflow-x-auto"
            >
              {CATEGORIES.map((category) => {
                const active = selectedCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-white text-neutral-950 shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {filteredMenu.map((item) => {
              const qty = qtyByItem.get(item.id) ?? 0;
              return (
                <article
                  key={item.id}
                  className="bg-white border border-neutral-200 rounded-xl overflow-hidden flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5"
                >
                  <div>
                    <div className="aspect-[4/3] bg-neutral-100 overflow-hidden">
                      {!failedImages[item.image_url] ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedImages((prev) => ({ ...prev, [item.image_url]: true }))
                          }
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400 gap-2">
                          <UtensilsCrossed className="w-6 h-6" aria-hidden="true" />
                          <span className="text-xs">{item.name}</span>
                        </div>
                      )}
                    </div>

                    <div className="p-5 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <span>{item.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{item.prep_minutes} мин</span>
                        {item.tag && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-red-700 font-medium">{item.tag}</span>
                          </>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-neutral-950 leading-snug">
                        {item.name}
                      </h3>
                      <p className="text-sm text-neutral-600 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="px-5 pb-5 pt-2 flex items-center justify-between gap-4">
                    <span className="font-mono text-base font-bold text-neutral-950 tabular-nums">
                      {item.price_kzt.toLocaleString('ru-RU')} ₸
                    </span>

                    {qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => onAddToCart(item.id)}
                        aria-label={`Добавить ${item.name} в корзину`}
                        className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        В корзину
                      </button>
                    ) : (
                      <div className="inline-flex items-center gap-2 border border-neutral-300 rounded-lg p-1">
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.id, -1)}
                          aria-label={`Уменьшить количество ${item.name}`}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-neutral-100 text-neutral-800 cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <span className="font-mono text-sm font-semibold w-5 text-center tabular-nums">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.id, 1)}
                          aria-label={`Увеличить количество ${item.name}`}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-neutral-100 text-neutral-800 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {/* Sticky Cart & Guest Checkout */}
        <aside
          id="cart-checkout-panel"
          className="lg:col-span-4 lg:sticky lg:top-24 bg-white border border-neutral-200 rounded-xl p-6 space-y-5"
        >
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold text-neutral-950">Ваш заказ</h2>
            <span className="text-xs text-neutral-500">Offline-корзина активна</span>
          </div>

          {cartDetails.length === 0 ? (
            <div className="py-6 text-center border-y border-neutral-100">
              <p className="text-sm text-neutral-500">
                Корзина пока пуста. Добавьте блюда из меню слева.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100 border-y border-neutral-100">
              {cartDetails.map(({ item, quantity, subtotal }) => (
                <li key={item.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-neutral-900 truncate">
                      {item.name}
                    </div>
                    <div className="text-xs text-neutral-500 font-mono tabular-nums">
                      {item.price_kzt.toLocaleString('ru-RU')} ₸ × {quantity}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-sm font-semibold text-neutral-950 tabular-nums">
                      {subtotal.toLocaleString('ru-RU')} ₸
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveFromCart(item.id)}
                      aria-label={`Удалить ${item.name} из корзины`}
                      className="p-1.5 text-neutral-400 hover:text-red-600 rounded cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between text-base font-bold text-neutral-950">
            <span>Итого к оплате</span>
            <span className="font-mono text-lg tabular-nums" data-testid="cart-total">
              {cartTotal.toLocaleString('ru-RU')} ₸
            </span>
          </div>

          <form onSubmit={handleCheckoutSubmit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="sector-field"
                className="block text-xs font-medium text-neutral-700 mb-1.5"
              >
                Сектор стадиона
              </label>
              <input
                id="sector-field"
                type="text"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="Например, Сектор A"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
              />
            </div>

            <div>
              <label
                htmlFor="seat-field"
                className="block text-xs font-medium text-neutral-700 mb-1.5"
              >
                Ряд и место
              </label>
              <input
                id="seat-field"
                type="text"
                value={seat}
                onChange={(e) => setSeat(e.target.value)}
                placeholder="Ряд 12, Место 5"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
              />
            </div>

            {formError && (
              <p role="alert" className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
            >
              <QrCode className="w-4 h-4" aria-hidden="true" />
              <span>Оплатить через Kaspi QR</span>
            </button>
          </form>

          {latestOrder && (
            <div
              data-testid="order-receipt"
              className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2"
            >
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                <Check className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                <span>Оплата Kaspi QR подтверждена</span>
              </div>
              <div className="text-xs text-emerald-800">Покажите этот код на стойке выдачи:</div>
              <div className="font-mono text-3xl font-extrabold text-emerald-950 tracking-wider tabular-nums">
                #{latestOrder.pickup_code}
              </div>
              <div className="text-[11px] font-mono text-emerald-800 break-all">
                UUID: {latestOrder.id}
              </div>
              <div className="text-xs text-emerald-900 font-medium tabular-nums">
                {latestOrder.sector} · {latestOrder.seat} ·{' '}
                {latestOrder.total_kzt.toLocaleString('ru-RU')} ₸
              </div>
            </div>
          )}

          {recentOrders.length > 0 && (
            <div className="pt-4 border-t border-neutral-200 space-y-2.5">
              <div className="text-xs font-semibold text-neutral-700">Ваши последние заказы</div>
              <ul className="space-y-2">
                {recentOrders.slice(0, 3).map((ord) => (
                  <li
                    key={ord.id}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-neutral-100 last:border-0"
                  >
                    <div>
                      <span className="font-mono font-bold text-neutral-950">
                        #{ord.pickup_code}
                      </span>
                      <span className="text-neutral-500"> · {ord.sector}</span>
                    </div>
                    <span className="font-medium text-neutral-700">
                      {STATUS_LABELS[ord.status]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </section>

      {/* Kaspi QR Mock Modal */}
      {showKaspiModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="kaspi-modal-title"
          className="fixed inset-0 z-50 bg-neutral-950/55 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-5 shadow-xl border border-neutral-200">
            <div className="space-y-1 text-center">
              <p className="text-xs font-semibold text-red-600">Kaspi QR Mock · Express Stadium</p>
              <h3 id="kaspi-modal-title" className="text-xl font-bold text-neutral-950">
                Подтверждение оплаты
              </h3>
              <p className="text-sm text-neutral-600">
                {sector} · {seat}
              </p>
            </div>

            <div className="mx-auto w-44 h-44 rounded-xl border border-neutral-200 bg-neutral-50 flex flex-col items-center justify-center p-4">
              <svg
                viewBox="0 0 100 100"
                className="w-32 h-32 text-neutral-900"
                aria-hidden="true"
              >
                <rect x="6" y="6" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="6" />
                <rect x="14" y="14" width="12" height="12" fill="currentColor" />
                <rect x="66" y="6" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="6" />
                <rect x="74" y="14" width="12" height="12" fill="currentColor" />
                <rect x="6" y="66" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="6" />
                <rect x="14" y="74" width="12" height="12" fill="currentColor" />
                <rect x="44" y="12" width="8" height="8" fill="#DC2626" />
                <rect x="44" y="28" width="8" height="16" fill="currentColor" />
                <rect x="12" y="46" width="16" height="8" fill="currentColor" />
                <rect x="38" y="48" width="24" height="8" fill="#DC2626" />
                <rect x="68" y="44" width="20" height="8" fill="currentColor" />
                <rect x="46" y="66" width="12" height="12" fill="currentColor" />
                <rect x="66" y="66" width="24" height="8" fill="currentColor" />
                <rect x="66" y="82" width="10" height="12" fill="#DC2626" />
                <rect x="82" y="82" width="12" height="12" fill="currentColor" />
              </svg>
            </div>

            <div className="text-center">
              <div className="text-xs text-neutral-500">Сумма к списанию</div>
              <div className="font-mono text-2xl font-extrabold text-neutral-950 tabular-nums">
                {cartTotal.toLocaleString('ru-RU')} ₸
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowKaspiModal(false)}
                disabled={submitting}
                className="px-4 py-2.5 text-sm font-semibold text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirmKaspiPayment}
                disabled={submitting}
                className="px-4 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'Оплата...' : 'Подтвердить оплату'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
