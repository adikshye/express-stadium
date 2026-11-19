(() => {
  const CART_KEY = "express_stadium_offline_cart";
  const page = document.body.dataset.page;

  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  if (page === "client") {
    let menu = [];
    let cart = loadCart();
    let pendingOrder = null;

    const menuGrid = document.getElementById("menu-grid");
    const cartItems = document.getElementById("cart-items");
    const cartTotal = document.getElementById("cart-total");
    const cartCount = document.getElementById("cart-count");
    const receipt = document.getElementById("order-receipt");
    const modal = document.getElementById("kaspi-modal");
    const kaspiAmount = document.getElementById("kaspi-amount");

    function renderCart() {
      cartCount.textContent = String(cart.reduce((sum, i) => sum + i.quantity, 0));
      if (!cart.length) {
        cartItems.innerHTML = "<p style='color:#6b7280;font-size:14px'>Корзина пуста</p>";
        cartTotal.textContent = "0 ₸";
        return;
      }
      let total = 0;
      cartItems.innerHTML = cart
        .map((c) => {
          const item = menu.find((m) => m.id === c.menu_item_id);
          if (!item) return "";
          const line = item.price_kzt * c.quantity;
          total += line;
          return `<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px">
            <span>${item.name} × ${c.quantity}</span>
            <strong>${line.toLocaleString("ru-RU")} ₸</strong>
          </div>`;
        })
        .join("");
      cartTotal.textContent = `${total.toLocaleString("ru-RU")} ₸`;
    }

    function addToCart(id) {
      const existing = cart.find((c) => c.menu_item_id === id);
      if (existing) existing.quantity += 1;
      else cart.push({ menu_item_id: id, quantity: 1 });
      saveCart(cart);
      renderCart();
    }

    async function initMenu() {
      const res = await fetch("/api/menu");
      menu = await res.json();
      menuGrid.innerHTML = menu
        .map(
          (item) => `<article class="card">
            <div style="font-size:12px;color:#6b7280">${item.category} · ${item.prep_minutes} мин</div>
            <h3 style="margin:6px 0">${item.name}</h3>
            <p style="font-size:13px;color:#4b5563">${item.description}</p>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">
              <span class="price">${item.price_kzt.toLocaleString("ru-RU")} ₸</span>
              <button class="btn-primary" data-add="${item.id}" type="button">В корзину</button>
            </div>
          </article>`
        )
        .join("");
      menuGrid.querySelectorAll("[data-add]").forEach((btn) => {
        btn.addEventListener("click", () => addToCart(Number(btn.dataset.add)));
      });
      renderCart();
    }

    document.getElementById("checkout-form").addEventListener("submit", (e) => {
      e.preventDefault();
      if (!cart.length) return;
      const sector = document.getElementById("sector-input").value.trim();
      const seat = document.getElementById("seat-input").value.trim();
      pendingOrder = { sector, seat, items: cart, payment_method: "Kaspi QR" };
      kaspiAmount.textContent = cartTotal.textContent;
      modal.classList.remove("hidden");
    });

    document.getElementById("kaspi-cancel").addEventListener("click", () => {
      modal.classList.add("hidden");
    });

    document.getElementById("kaspi-confirm").addEventListener("click", async () => {
      if (!pendingOrder) return;
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingOrder),
      });
      const order = await res.json();
      modal.classList.add("hidden");
      cart = [];
      saveCart(cart);
      renderCart();
      receipt.classList.remove("hidden");
      receipt.innerHTML = `<strong>Заказ подтвержден!</strong><br/>Код выдачи: <strong>#${order.pickup_code}</strong><br/>UUID: <code>${order.id}</code><br/>Итого: ${order.total_kzt.toLocaleString("ru-RU")} ₸`;
    });

    initMenu();
  }

  if (page === "seller") {
    const wipCounter = document.getElementById("wip-counter");
    const wipAlert = document.getElementById("wip-alert");

    async function loadOrders() {
      const res = await fetch("/api/orders");
      const data = await res.json();
      wipCounter.textContent = `${data.wip_count} / ${data.wip_limit}`;
      const cols = {
        new: document.getElementById("col-new"),
        in_progress: document.getElementById("col-in_progress"),
        ready: document.getElementById("col-ready"),
      };
      Object.values(cols).forEach((el) => (el.innerHTML = ""));
      const counts = { new: 0, in_progress: 0, ready: 0 };

      data.orders.forEach((order) => {
        if (!cols[order.status]) return;
        counts[order.status] += 1;
        const nextStatus = order.status === "new" ? "in_progress" : order.status === "in_progress" ? "ready" : "completed";
        const nextLabel = order.status === "new" ? "Взять в работу" : order.status === "in_progress" ? "Готово к выдаче" : "Выдано клиенту";
        const card = document.createElement("div");
        card.className = "order-card";
        card.innerHTML = `<div style="display:flex;justify-content:space-between">
            <strong>#${order.pickup_code}</strong>
            <span>${order.total_kzt.toLocaleString("ru-RU")} ₸</span>
          </div>
          <div style="font-size:12px;color:#6b7280;margin:4px 0">${order.sector} · ${order.seat}</div>
          <div style="font-size:13px;margin:8px 0">${order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}</div>
          <button class="btn-primary full" type="button">${nextLabel}</button>`;
        card.querySelector("button").addEventListener("click", async () => {
          wipAlert.classList.add("hidden");
          const patch = await fetch(`/api/orders/${order.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: nextStatus, actor: "seller_kanban" }),
          });
          if (!patch.ok) {
            const err = await patch.json();
            wipAlert.textContent = err.detail || "Ошибка обновления статуса";
            wipAlert.classList.remove("hidden");
            return;
          }
          loadOrders();
        });
        cols[order.status].appendChild(card);
      });

      document.getElementById("count-new").textContent = String(counts.new);
      document.getElementById("count-progress").textContent = String(counts.in_progress);
      document.getElementById("count-ready").textContent = String(counts.ready);
    }

    document.getElementById("refresh-orders").addEventListener("click", loadOrders);
    loadOrders();
  }
})();
