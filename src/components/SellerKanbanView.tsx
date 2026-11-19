import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';
import { AuditLogEntry, OrderRecord, OrderStatus, WIP_LIMIT } from '../lib/expressLogic';

interface SellerKanbanViewProps {
  orders: OrderRecord[];
  wipCount: number;
  wipLimit: number;
  auditLogs: AuditLogEntry[];
  onRefresh: () => Promise<void>;
  onStatusUpdated: () => Promise<void>;
}

const COLUMNS: Array<{
  status: OrderStatus;
  title: string;
  subtitle: string;
  nextStatus: OrderStatus;
  nextLabel: string;
}> = [
  {
    status: 'new',
    title: 'Новые заказы',
    subtitle: 'Оплачены через Kaspi QR',
    nextStatus: 'in_progress',
    nextLabel: 'Взять в работу',
  },
  {
    status: 'in_progress',
    title: 'Готовятся (WIP: 3)',
    subtitle: 'Активная сборка на кухне',
    nextStatus: 'ready',
    nextLabel: 'Готово к выдаче',
  },
  {
    status: 'ready',
    title: 'Готовы к выдаче',
    subtitle: 'Ожидают болельщика на стойке',
    nextStatus: 'completed',
    nextLabel: 'Выдано клиенту',
  },
];

export const SellerKanbanView: React.FC<SellerKanbanViewProps> = ({
  orders,
  wipCount,
  wipLimit = WIP_LIMIT,
  auditLogs,
  onRefresh,
  onStatusUpdated,
}) => {
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const isWipAtLimit = wipCount >= wipLimit;

  const handleTransition = async (orderId: string, nextStatus: OrderStatus) => {
    setErrorBanner(null);
    setBusyId(orderId);
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, actor: 'seller_kanban' }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorBanner(data.detail || 'Не удалось обновить статус заказа.');
        return;
      }
      await onStatusUpdated();
    } catch {
      setErrorBanner('Ошибка сети при обновлении статуса.');
    } finally {
      setBusyId(null);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    setErrorBanner(null);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-tight">
            Kanban-доска продавца
          </h1>
          <p className="text-sm text-neutral-600 mt-1">
            Модель поставки Kanban (ADR-001, ЛЗ-9): ограничение незавершенной работы предотвращает перегрузку выдачи.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div
            data-testid="wip-indicator"
            className={`px-4 py-2 rounded-lg border text-sm font-semibold tabular-nums ${
              isWipAtLimit
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-white border-neutral-200 text-neutral-900'
            }`}
          >
            <span className="font-mono">WIP: {wipCount} / {wipLimit}</span>
            <span className="text-xs font-normal ml-2">
              {isWipAtLimit ? 'Лимит достигнут' : 'Поток в норме'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-800 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Обновить</span>
          </button>
        </div>
      </div>

      {errorBanner && (
        <div
          role="alert"
          data-testid="wip-error-alert"
          className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-sm"
        >
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <div className="font-semibold">Ограничение потока WIP</div>
            <p className="text-red-800 mt-0.5">{errorBanner}</p>
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.status);
          return (
            <div
              key={col.status}
              data-testid={`kanban-col-${col.status}`}
              className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4"
            >
              <div className="flex items-baseline justify-between pb-3 border-b border-neutral-100">
                <div>
                  <h2 className="text-base font-bold text-neutral-950">{col.title}</h2>
                  <p className="text-xs text-neutral-500 mt-0.5">{col.subtitle}</p>
                </div>
                <span className="font-mono text-sm font-bold text-neutral-700 tabular-nums">
                  {col.status === 'in_progress'
                    ? `${colOrders.length}/${wipLimit}`
                    : colOrders.length}
                </span>
              </div>

              {colOrders.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-400">
                  В этой колонке пока нет заказов
                </div>
              ) : (
                <div className="space-y-3">
                  {colOrders.map((order) => (
                    <article
                      key={order.id}
                      className="p-4 rounded-lg bg-[#F8F9FA] border border-neutral-200 space-y-3"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-lg font-extrabold text-neutral-950 tabular-nums">
                          #{order.pickup_code}
                        </span>
                        <span className="font-mono text-sm font-semibold text-neutral-800 tabular-nums">
                          {order.total_kzt.toLocaleString('ru-RU')} ₸
                        </span>
                      </div>

                      <div className="text-xs text-neutral-600">
                        {order.sector} · {order.seat} · {order.payment_method}
                      </div>

                      <ul className="text-xs text-neutral-800 space-y-1 border-t border-neutral-200/70 pt-2">
                        {order.items.map((item) => (
                          <li key={item.menu_item_id} className="flex justify-between gap-2">
                            <span>{item.name}</span>
                            <span className="font-mono tabular-nums text-neutral-600">
                              ×{item.quantity}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <button
                        type="button"
                        disabled={busyId === order.id}
                        onClick={() => handleTransition(order.id, col.nextStatus)}
                        aria-label={`${col.nextLabel} для заказа #${order.pickup_code}`}
                        className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                          col.status === 'ready'
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-neutral-900 text-white hover:bg-neutral-800'
                        }`}
                      >
                        {col.status === 'ready' ? (
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        <span>{busyId === order.id ? 'Обновление...' : col.nextLabel}</span>
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Immutable Audit Log (STRIDE Repudiation / EXP-10) */}
      <section className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-neutral-950">
              Неизменяемый журнал аудита (EXP-10)
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Защита от угрозы STRIDE Repudiation: каждое создание и смена статуса фиксируется на сервере.
            </p>
          </div>
          <span className="font-mono text-xs text-neutral-500 tabular-nums">
            Записей: {auditLogs.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
                <th className="py-2.5 px-6 font-medium">Время</th>
                <th className="py-2.5 px-4 font-medium">Код</th>
                <th className="py-2.5 px-4 font-medium">Событие</th>
                <th className="py-2.5 px-4 font-medium">Актор</th>
                <th className="py-2.5 px-6 font-medium">Детали</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {auditLogs.slice(0, 8).map((entry) => (
                <tr key={entry.id} className="hover:bg-neutral-50/70">
                  <td className="py-2.5 px-6 font-mono text-xs text-neutral-500 tabular-nums whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleTimeString('ru-RU')}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs font-semibold text-neutral-900 tabular-nums">
                    #{entry.pickup_code}
                  </td>
                  <td className="py-2.5 px-4 text-xs font-medium text-neutral-700">
                    {entry.action}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs text-neutral-500">
                    {entry.actor}
                  </td>
                  <td className="py-2.5 px-6 text-xs text-neutral-700">{entry.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
