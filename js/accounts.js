/**
 * BankEase - Accounts Page Logic
 */

document.addEventListener("DOMContentLoaded", async () => {
    if (!api.isAuthenticated()) return;
    await loadAccounts();

    const openBtn = document.getElementById("open-modal-btn");
    const modal = document.getElementById("new-account-modal");
    if (openBtn && modal) {
        openBtn.addEventListener("click", () => modal.classList.remove("hidden"));
    }

    const form = document.getElementById("new-account-form");
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const account_type = document.getElementById("new-acc-type").value;
            const initial_deposit = document.getElementById("new-acc-deposit").value;

            try {
                const res = await api.post("/accounts/", { account_type, initial_deposit });
                if (res.status === "success") {
                    showToast("New account opened successfully!", "success");
                    closeModal();
                    await loadAccounts();
                }
            } catch (err) {
                showToast(err.message, "error");
            }
        });
    }
});

function closeModal() {
    const modal = document.getElementById("new-account-modal");
    if (modal) modal.classList.add("hidden");
}

async function loadAccounts() {
    const grid = document.getElementById("accounts-grid");
    if (!grid) return;

    try {
        const res = await api.get("/accounts/");
        if (res.status === "success") {
            const accounts = res.data;
            if (accounts.length === 0) {
                grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;">No accounts found. Click 'Open New Account' to create one.</div>`;
                return;
            }

            grid.innerHTML = accounts.map(acc => {
                const statusBadge = acc.account_status === "ACTIVE" ? "badge-success" : "badge-danger";
                const isSavings = acc.account_type === "SAVINGS";
                return `
                    <div class="card" style="border-top: 4px solid ${isSavings ? '#2563eb' : '#0d9488'}; position: relative;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                            <div>
                                <span class="badge ${statusBadge}">${acc.account_status_display}</span>
                                <h3 style="font-size: 18px; margin-top: 8px; font-weight: 700;">${acc.account_type_display}</h3>
                            </div>
                            <div style="font-size: 28px;">${isSavings ? '🏦' : '💼'}</div>
                        </div>

                        <div style="color: var(--text-muted); font-size: 13px; font-family: monospace; letter-spacing: 1px;">
                            A/C: ${acc.account_number}
                        </div>

                        <div style="margin: 20px 0;">
                            <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">Available Balance</div>
                            <div style="font-size: 28px; font-weight: 800; color: var(--text-primary); margin-top: 2px;">
                                ₹${parseFloat(acc.balance).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                            </div>
                        </div>

                        <div style="display: flex; gap: 8px; border-top: 1px solid var(--border); padding-top: 16px;">
                            <a href="transfer.html?source=${acc.id}" class="btn btn-primary btn-sm btn-block">Transfer</a>
                            <a href="transactions.html?account_id=${acc.id}" class="btn btn-secondary btn-sm btn-block">Statement</a>
                        </div>
                    </div>
                `;
            }).join("");
        }
    } catch (err) {
        showToast("Error loading accounts: " + err.message, "error");
    }
}
