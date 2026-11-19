/**
 * BankEase - Transactions Statement Logic
 */

document.addEventListener("DOMContentLoaded", async () => {
    if (!api.isAuthenticated()) return;
    await loadTransactions();
});

async function loadTransactions() {
    const tbody = document.getElementById("transactions-body");
    if (!tbody) return;

    const type = document.getElementById("filter-type")?.value || "";
    const status = document.getElementById("filter-status")?.value || "";

    const params = new URLSearchParams(window.location.search);
    const account_id = params.get("account_id");

    let url = `/transactions/?`;
    if (type) url += `type=${type}&`;
    if (status) url += `status=${status}&`;
    if (account_id) url += `account_id=${account_id}&`;

    try {
        const res = await api.get(url);
        // PageNumberPagination returns { count, next, previous, results }
        const txns = res.results || res.data || [];

        if (txns.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No transaction records match the selected criteria.</td></tr>`;
            return;
        }

        tbody.innerHTML = txns.map(txn => {
            const date = new Date(txn.created_at).toLocaleString("en-IN", {
                day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
            });
            const isDebit = ["TRANSFER", "BILL_PAYMENT", "LOAN_REPAYMENT", "INVESTMENT"].includes(txn.transaction_type);
            const statusBadge = txn.transaction_status === "COMPLETED" ? "badge-success" : "badge-danger";

            // Format ledger entry details
            let ledgerSummary = "-";
            if (txn.ledger_entries && txn.ledger_entries.length > 0) {
                ledgerSummary = txn.ledger_entries.map(le => `
                    <span style="font-size: 11px; display: block;">
                        ${le.entry_type} A/C ${le.account_number} (Bal: ₹${parseFloat(le.balance_after).toLocaleString('en-IN')})
                    </span>
                `).join("");
            }

            return `
                <tr>
                    <td><code>${txn.reference_number}</code></td>
                    <td>${txn.initiated_by_name || 'System'}</td>
                    <td><span class="badge badge-info">${txn.transaction_type}</span></td>
                    <td style="font-weight: 700; color: ${isDebit ? '#ef4444' : '#10b981'};">
                        ${isDebit ? '-' : '+'}₹${parseFloat(txn.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                    </td>
                    <td><span class="badge ${statusBadge}">${txn.transaction_status}</span></td>
                    <td style="color: var(--text-secondary); font-size: 13px;">${date}</td>
                    <td>${ledgerSummary}</td>
                </tr>
            `;
        }).join("");
    } catch (err) {
        showToast("Error loading transaction history: " + err.message, "error");
    }
}

function exportStatement() {
    window.print();
}
