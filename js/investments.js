/**
 * BankEase - Investments Page Logic
 * Handles investment products, placing orders, viewing holdings and order history.
 */

document.addEventListener("DOMContentLoaded", () => {
    loadInvestmentProducts();
    loadHoldings();
    loadOrders();
    loadAccountsForInvest();

    const orderForm = document.getElementById("invest-order-form");
    if (orderForm) {
        orderForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = orderForm.querySelector("button[type='submit']");
            btn.disabled = true;
            btn.textContent = "Processing...";

            try {
                const payload = {
                    product_id: parseInt(document.getElementById("invest-product-select").value),
                    account_id: parseInt(document.getElementById("invest-account-select").value),
                    amount: document.getElementById("invest-amount").value,
                };
                await api.post("/investments/orders/", payload);
                showToast("Investment order placed successfully!", "success");
                orderForm.reset();
                loadHoldings();
                loadOrders();
                loadAccountsForInvest();
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                btn.disabled = false;
                btn.textContent = "Invest Now";
            }
        });
    }
});

async function loadInvestmentProducts() {
    try {
        const res = await api.get("/investments/products/");
        const products = res.results || res;
        const grid = document.getElementById("invest-products-grid");
        const select = document.getElementById("invest-product-select");
        if (!grid) return;

        if (!products.length) {
            grid.innerHTML = '<p style="color: var(--text-muted);">No investment products available.</p>';
            return;
        }

        const riskColors = { LOW: "#22c55e", MEDIUM: "#f59e0b", HIGH: "#ef4444" };

        grid.innerHTML = products.map(p => `
            <div class="card">
                <div style="padding: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h3 style="font-size: 15px; font-weight: 700;">${p.product_name}</h3>
                        <span class="badge" style="background: ${riskColors[p.risk_level] || "#64748b"}20; color: ${riskColors[p.risk_level] || "#64748b"}; font-size: 11px;">${p.risk_level_display || p.risk_level}</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-secondary);">
                        <div>Type: <strong>${p.product_type_display || p.product_type}</strong></div>
                        <div>Min. Investment: <strong>₹${Number(p.minimum_amount).toLocaleString()}</strong></div>
                        <div>Status: <span class="badge badge-${p.status === 'ACTIVE' ? 'success' : 'secondary'}">${p.status}</span></div>
                    </div>
                </div>
            </div>
        `).join("");

        if (select) {
            select.innerHTML = products
                .filter(p => p.status === "ACTIVE")
                .map(p => `<option value="${p.id}">${p.product_name} (Min: ₹${Number(p.minimum_amount).toLocaleString()})</option>`)
                .join("");
        }
    } catch (err) {
        showToast("Failed to load investment products.", "error");
    }
}

async function loadHoldings() {
    try {
        const res = await api.get("/investments/holdings/");
        const holdings = res.results || res;
        const tbody = document.getElementById("holdings-body");
        if (!tbody) return;
        if (!holdings.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No holdings yet. Place your first investment order!</td></tr>';
            return;
        }
        tbody.innerHTML = holdings.map(h => `
            <tr>
                <td><strong>${h.product_name}</strong></td>
                <td>${h.product_type}</td>
                <td><span class="badge badge-${h.risk_level === 'LOW' ? 'success' : h.risk_level === 'HIGH' ? 'danger' : 'warning'}">${h.risk_level}</span></td>
                <td>${Number(h.units).toFixed(2)}</td>
                <td>₹${Number(h.invested_amount).toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
            </tr>
        `).join("");
    } catch (err) {
        showToast("Failed to load holdings.", "error");
    }
}

async function loadOrders() {
    try {
        const res = await api.get("/investments/orders/");
        const orders = res.results || res;
        const tbody = document.getElementById("orders-body");
        if (!tbody) return;
        if (!orders.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No orders placed yet.</td></tr>';
            return;
        }
        tbody.innerHTML = orders.map(o => `
            <tr>
                <td>${new Date(o.created_at).toLocaleDateString()}</td>
                <td>${o.product_name}</td>
                <td>₹${Number(o.amount).toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
                <td><span class="badge badge-${o.order_status === 'EXECUTED' ? 'success' : o.order_status === 'CANCELLED' ? 'danger' : 'warning'}">${o.order_status}</span></td>
                <td><code>${o.reference_number || "—"}</code></td>
            </tr>
        `).join("");
    } catch (err) {
        showToast("Failed to load order history.", "error");
    }
}

async function loadAccountsForInvest() {
    try {
        const res = await api.get("/accounts/");
        const accounts = res.results || res;
        const select = document.getElementById("invest-account-select");
        if (select) {
            select.innerHTML = accounts.map(a => `<option value="${a.id}">${a.account_number} (₹${Number(a.balance).toLocaleString()})</option>`).join("");
        }
    } catch (err) {
        console.error("Failed to load accounts for invest select.");
    }
}
