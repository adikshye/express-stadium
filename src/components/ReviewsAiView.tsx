import React, { useState } from 'react';
import { ShieldCheck, Send } from 'lucide-react';
import { ReviewRecord } from '../lib/expressLogic';

interface ReviewsAiViewProps {
  reviews: ReviewRecord[];
  onReviewCreated: (review: ReviewRecord) => void;
}

const SAMPLE_PROMPTS = [
  {
    label: 'Пример: Сбой Kaspi + Телефон',
    text: 'Оплата через Kaspi QR прошла дважды, перезвоните мне +7 701 555 44 33 или напишите fan@mail.kz',
  },
  {
    label: 'Пример: Холодный бургер + Телефон',
    text: 'Бургер оказался холодным на выдаче, мой номер 8 777 123 45 67',
  },
  {
    label: 'Пример: Баг приложения',
    text: 'После подтверждения оплаты экран завис и кнопка закрытия не сработала',
  },
];

export const ReviewsAiView: React.FC<ReviewsAiViewProps> = ({ reviews, onReviewCreated }) => {
  const [orderCode, setOrderCode] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (text.trim().length < 3) {
      setError('Введите текст отзыва (минимум 3 символа).');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          order_code: orderCode.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.detail || 'Не удалось сохранить отзыв.');
        return;
      }
      setText('');
      setOrderCode('');
      onReviewCreated(data);
    } catch {
      setError('Ошибка сети при отправке отзыва.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-tight">
          Отзывы болельщиков и ИИ-классификатор
        </h1>
        <p className="text-sm text-neutral-600 mt-1 max-w-3xl">
          Реализация ADR-002 и задачи EXP-28 (ЛЗ-12): сервер автоматически удаляет телефоны и email
          до отправки в ИИ-модель и распределяет обращения по 4 категориям (Accuracy 90%).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-white border border-neutral-200 rounded-xl p-6 space-y-5"
          noValidate
        >
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-neutral-950">Оставить отзыв</h2>
            <p className="text-xs text-neutral-500">
              Попробуйте указать номер телефона — он заменится на{' '}
              <code className="font-mono text-neutral-800">[PHONE_REDACTED]</code>.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {SAMPLE_PROMPTS.map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => setText(sample.text)}
                className="px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 rounded-md hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                {sample.label}
              </button>
            ))}
          </div>

          <div>
            <label
              htmlFor="review-order-code"
              className="block text-xs font-medium text-neutral-700 mb-1.5"
            >
              Код заказа (необязательно)
            </label>
            <input
              id="review-order-code"
              type="text"
              value={orderCode}
              onChange={(e) => setOrderCode(e.target.value)}
              placeholder="Например, 48291"
              className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
            />
          </div>

          <div>
            <label
              htmlFor="review-text"
              className="block text-xs font-medium text-neutral-700 mb-1.5"
            >
              Текст отзыва
            </label>
            <textarea
              id="review-text"
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Напишите о качестве еды, оплате Kaspi QR, приложении или работе стойки..."
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            <span>{submitting ? 'Обработка...' : 'Отправить и классифицировать'}</span>
          </button>
        </form>

        <section className="lg:col-span-7 bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
            <h2 className="text-base font-bold text-neutral-950">
              Лента классифицированных отзывов
            </h2>
            <span className="font-mono text-xs text-neutral-500 tabular-nums">
              Всего: {reviews.length}
            </span>
          </div>

          <ul className="divide-y divide-neutral-100" data-testid="reviews-list">
            {reviews.map((rev) => (
              <li key={rev.id} className="p-6 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-neutral-600">
                    <span className="font-semibold text-neutral-950">{rev.ai_category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      Уверенность {Math.round(rev.confidence * 100)}%
                    </span>
                    {rev.order_code && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">Заказ #{rev.order_code}</span>
                      </>
                    )}
                  </div>

                  <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                    <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{rev.pii_masked ? 'ПДн замаскированы (EXP-28)' : 'ПДн не обнаружены'}</span>
                  </div>
                </div>

                <p className="text-sm text-neutral-800 leading-relaxed">{rev.redacted_text}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};
