import React, { useCallback, useEffect, useState } from 'react';
import { ActiveTab, TopBar } from './components/TopBar';
import { CartEntry, StorefrontView } from './components/StorefrontView';
import { SellerKanbanView } from './components/SellerKanbanView';
import { ReviewsAiView } from './components/ReviewsAiView';
import { DevOpsHubView, ProjectArtifactsData } from './components/DevOpsHubView';
import {
  AuditLogEntry,
  MENU_ITEMS,
  MenuItem,
  OrderRecord,
  ReviewRecord,
  WIP_LIMIT,
} from './lib/expressLogic';

const CART_STORAGE_KEY = 'express_stadium_cart_v2';
const RECENT_ORDERS_KEY = 'express_stadium_recent_orders_v2';

function readStoredJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('storefront');
  const [menu, setMenu] = useState<MenuItem[]>(MENU_ITEMS);
  const [cart, setCart] = useState<CartEntry[]>(() => readStoredJson(CART_STORAGE_KEY, []));
  const [recentOrders, setRecentOrders] = useState<OrderRecord[]>(() =>
    readStoredJson(RECENT_ORDERS_KEY, [])
  );
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [wipCount, setWipCount] = useState<number>(0);
  const [wipLimit, setWipLimit] = useState<number>(WIP_LIMIT);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [artifacts, setArtifacts] = useState<ProjectArtifactsData | null>(null);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify(recentOrders));
  }, [recentOrders]);

  const fetchOrdersAndAudit = useCallback(async () => {
    const [ordersRes, auditRes] = await Promise.all([fetch('/api/orders'), fetch('/api/audit')]);
    if (ordersRes.ok) {
      const data = await ordersRes.json();
      setOrders(data.orders);
      setWipCount(data.wip_count);
      setWipLimit(data.wip_limit);
      // Sync live statuses into customer's locally stored recent orders
      setRecentOrders((prev) =>
        prev.map((localOrder) => {
          const serverMatch = (data.orders as OrderRecord[]).find((o) => o.id === localOrder.id);
          return serverMatch ? serverMatch : localOrder;
        })
      );
    }
    if (auditRes.ok) {
      setAuditLogs(await auditRes.json());
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function bootstrap() {
      try {
        const [menuRes, reviewsRes, artifactsRes] = await Promise.all([
          fetch('/api/menu'),
          fetch('/api/reviews'),
          fetch('/api/artifacts'),
        ]);
        if (!mounted) return;
        if (menuRes.ok) setMenu(await menuRes.json());
        if (reviewsRes.ok) setReviews(await reviewsRes.json());
        if (artifactsRes.ok) setArtifacts(await artifactsRes.json());
        await fetchOrdersAndAudit();
      } catch {
        // Keep initial seed menu if offline
      }
    }
    bootstrap();
    return () => {
      mounted = false;
    };
  }, [fetchOrdersAndAudit]);

  const handleAddToCart = (menuItemId: number) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menu_item_id === menuItemId);
      if (existing) {
        return prev.map((c) =>
          c.menu_item_id === menuItemId ? { ...c, quantity: Math.min(20, c.quantity + 1) } : c
        );
      }
      return [...prev, { menu_item_id: menuItemId, quantity: 1 }];
    });
  };

  const handleUpdateQty = (menuItemId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.menu_item_id === menuItemId ? { ...c, quantity: c.quantity + delta } : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const handleRemoveFromCart = (menuItemId: number) => {
    setCart((prev) => prev.filter((c) => c.menu_item_id !== menuItemId));
  };

  const handleOrderCreated = (order: OrderRecord) => {
    setCart([]);
    setRecentOrders((prev) => [order, ...prev].slice(0, 10));
    void fetchOrdersAndAudit();
  };

  const handleReviewCreated = (review: ReviewRecord) => {
    setReviews((prev) => [review, ...prev]);
  };

  const handleCartClick = () => {
    setActiveTab('storefront');
    window.requestAnimationFrame(() => {
      document.getElementById('cart-checkout-panel')?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] text-[#111827]">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        cartCount={totalCartItems}
        onCartClick={handleCartClick}
      />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {activeTab === 'storefront' && (
          <StorefrontView
            menu={menu}
            cart={cart}
            recentOrders={recentOrders}
            onAddToCart={handleAddToCart}
            onUpdateQty={handleUpdateQty}
            onRemoveFromCart={handleRemoveFromCart}
            onOrderCreated={handleOrderCreated}
            onOpenSeller={() => setActiveTab('seller')}
          />
        )}

        {activeTab === 'seller' && (
          <SellerKanbanView
            orders={orders}
            wipCount={wipCount}
            wipLimit={wipLimit}
            auditLogs={auditLogs}
            onRefresh={fetchOrdersAndAudit}
            onStatusUpdated={fetchOrdersAndAudit}
          />
        )}

        {activeTab === 'reviews' && (
          <ReviewsAiView reviews={reviews} onReviewCreated={handleReviewCreated} />
        )}

        {activeTab === 'project' && <DevOpsHubView artifacts={artifacts} />}
      </main>

      <footer className="border-t border-neutral-200 bg-white mt-12">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-500">
          <span>Express Stadium · Сквозной проект предзаказа еды на стадионе</span>
          <div className="flex items-center gap-4">
            <a href="/frontend/index.html" className="hover:text-neutral-900">
              Static MVP (Client)
            </a>
            <a href="/seller.html" className="hover:text-neutral-900">
              Static MVP (Seller)
            </a>
            <a href="/api/health" className="hover:text-neutral-900 font-mono">
              /api/health
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
