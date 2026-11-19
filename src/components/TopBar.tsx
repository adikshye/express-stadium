import React from 'react';
import { ShoppingBag } from 'lucide-react';

export type ActiveTab = 'storefront' | 'seller' | 'reviews' | 'project';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  cartCount: number;
  onCartClick: () => void;
}

const NAV_ITEMS: Array<{ id: ActiveTab; label: string }> = [
  { id: 'storefront', label: 'Витрина' },
  { id: 'seller', label: 'Доска продавца' },
  { id: 'reviews', label: 'Отзывы' },
  { id: 'project', label: 'Проект' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  cartCount,
  onCartClick,
}) => {
  return (
    <header className="md:sticky md:top-0 z-30 bg-white/95 backdrop-blur border-b border-neutral-200">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
        <button
          type="button"
          onClick={() => onSelectTab('storefront')}
          className="font-display text-xl font-extrabold tracking-tight text-neutral-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
        >
          Express
        </button>

        <nav
          aria-label="Основная навигация"
          className="hidden md:flex items-center gap-7"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
                  isActive
                    ? 'text-neutral-950 font-semibold'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-red-600"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onCartClick}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 active:scale-[0.99] transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          >
            <ShoppingBag className="w-4 h-4" aria-hidden="true" />
            <span>Корзина</span>
            <span className="font-mono tabular-nums" data-testid="header-cart-count">
              ({cartCount})
            </span>
          </button>
        </div>
      </div>

      {/* Mobile navigation bar: all 4 sections visible and tappable with zero clipping */}
      <nav
        aria-label="Мобильная навигация"
        className="md:hidden grid grid-cols-4 border-t border-neutral-100 px-2"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          const shortLabel = item.id === 'seller' ? 'Kanban' : item.label;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative py-2.5 text-xs font-medium text-center whitespace-nowrap transition-colors cursor-pointer ${
                isActive ? 'text-neutral-950 font-semibold' : 'text-neutral-500'
              }`}
            >
              {shortLabel}
              {isActive && (
                <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-0.5 bg-red-600" />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
