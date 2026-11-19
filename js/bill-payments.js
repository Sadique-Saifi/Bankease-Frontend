/**
 * BankEase - Bill Payments Logic
 */

let allBillers = [];

document.addEventListener("DOMContentLoaded", async () => {
    if (!api.isAuthenticated()) return;
    await loadBillers();
    await loadAccounts();
    await loadPastBillPayments();

    const form = document.getElementById("bill-pay-form");
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = document.getElementById("bill-submit-btn");

            const biller_id = document.getElementById("biller-select").value;
            const consumer_reference = document.getElementById("consumer-ref").value.trim();
            const account_id = document.getElementById("bill-source-account").value;
            const amount = document.getElementById("bill-amount").value;

            try {
                btn.disabled = true;
                btn.textContent = "Processing Payment...";

                const res = await api.post("/bill-payments/", {
                    biller_id: parseInt(biller_id),
                    consumer_reference,
                    account_id: parseInt(account_id),
                    amount,
                });

                if (res.status === "success") {
                    showToast("Bill paid successfully!", "success");
                    form.reset();
                    await loadAccounts();
                    await loadPastBillPayments();
                }
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                btn.disabled = false;
                btn.textContent = "Authorize & Pay Bill";
            }
        });
    }
});

async function loadBillers() {
    try {
        const res = await api.get("/billers/");
        if (res.status === "success") {
            allBillers = res.data;
            renderBillers(allBillers);
        }
    } catch (err) {
        showToast("Error loading billers: " + err.message, "error");
    }
}

function filterBillersByCategory() {
    const cat = document.getElementById("bill-category").value;
    if (!cat) {
        renderBillers(allBillers);
    } else {
        renderBillers(allBillers.filter(b => b.category === cat));
    }
}

function renderBillers(billers) {
    const select = document.getElementById("biller-select");
    if (!select) return;

    if (billers.length === 0) {
        select.innerHTML = `<option value="">No billers in this category</option>`;
        return;
    }

    select.innerHTML = `<option value="">Select Biller</option>` + billers.map(b => `
        <option value="${b.id}">${b.name} (${b.category_display})</option>
    `).join("");
}

async function loadAccounts() {
    const select = document.getElementById("bill-source-account");
    if (!select) return;

    try {
        const res = await api.get("/accounts/");
        if (res.status === "success") {
            select.innerHTML = res.data.map(acc => `
                <option value="${acc.id}">
                    ${acc.account_type_display} - ${acc.account_number} (₹${parseFloat(acc.balance).toLocaleString('en-IN')})
                </option>
            `).join("");
        }
    } catch (err) {
        showToast("Error loading accounts: " + err.message, "error");
    }
}

async function loadPastBillPayments() {
    const tbody = document.getElementById("bill-history-body");
    if (!tbody) return;

    try {
        const res = await api.get("/bill-payments/");
        if (res.status === "success") {
            const list = res.data;
            if (list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3" class="empty-state">No bills paid yet.</td></tr>`;
                return;
            }

            tbody.innerHTML = list.map(p => `
                <tr>
                    <td>
                        <strong>${p.biller_name}</strong><br>
                        <span style="font-size: 11px; color: var(--text-muted);">Ref: ${p.consumer_reference}</span>
                    </td>
                    <td><code>${p.reference_number}</code></td>
                    <td style="font-weight: 700; color: #ef4444;">₹${parseFloat(p.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                </tr>
            `).join("");
        }
    } catch (err) {
        showToast("Error loading bill history: " + err.message, "error");
    }
}
