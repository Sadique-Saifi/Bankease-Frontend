/**
 * BankEase - Dashboard Logic (Customer & Officer View Switching)
 */

document.addEventListener("DOMContentLoaded", async () => {
    if (!api.isAuthenticated()) return;

    const user = api.getUser();
    const isOfficer = api.isBankOfficer();

    // Toggle role-specific navigation
    if (isOfficer) {
        document.querySelectorAll(".customer-only").forEach(el => el.classList.add("hidden"));
    }

    const greeting = document.getElementById("page-greeting");
    if (greeting) {
        greeting.textContent = `Welcome, ${user.full_name || user.username}`;
    }

    // Set Initials
    const initials = (user.full_name || user.username)
        .split(" ")
        .map(n => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();
    document.querySelectorAll(".user-initials").forEach(el => el.textContent = initials);

    if (isOfficer) {
        document.getElementById("officer-view").classList.remove("hidden");
        await loadOfficerDashboard();
    } else {
        document.getElementById("customer-view").classList.remove("hidden");
        await loadCustomerDashboard();
    }
});

async function loadCustomerDashboard() {
    try {
        const res = await api.get("/dashboard/customer/");
        if (res.status === "success") {
            const data = res.data;

            // Stats
            document.getElementById("cust-total-balance").textContent = `₹${parseFloat(data.total_balance).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
            document.getElementById("cust-accounts-count").textContent = data.total_accounts;
            document.getElementById("cust-monthly-debits").textContent = `₹${parseFloat(data.monthly_debits).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
            document.getElementById("cust-monthly-credits").textContent = `₹${parseFloat(data.monthly_credits).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
            document.getElementById("cust-total-invested").textContent = `₹${parseFloat(data.investment_summary.total_invested).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;

            // Notifications dot
            if (data.unread_notifications > 0) {
                const dot = document.getElementById("unread-dot");
                if (dot) dot.classList.remove("hidden");
            }

            // Recent Transactions Table
            const tbody = document.getElementById("cust-transactions-body");
            if (tbody) {
                if (data.recent_transactions.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No transactions recorded yet.</td></tr>`;
                } else {
                    tbody.innerHTML = data.recent_transactions.map(txn => {
                        const date = new Date(txn.created_at).toLocaleDateString("en-IN", {
                            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                        });
                        const isDebit = ["TRANSFER", "BILL_PAYMENT", "LOAN_REPAYMENT", "INVESTMENT"].includes(txn.transaction_type);
                        const statusClass = txn.transaction_status === "COMPLETED" ? "badge-success" : "badge-danger";
                        return `
                            <tr>
                                <td><code>${txn.reference_number}</code></td>
                                <td><span class="badge badge-info">${txn.transaction_type}</span></td>
                                <td style="font-weight: 600; color: ${isDebit ? '#ef4444' : '#10b981'};">
                                    ${isDebit ? '-' : '+'}₹${parseFloat(txn.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                                </td>
                                <td><span class="badge ${statusClass}">${txn.transaction_status}</span></td>
                                <td style="color: var(--text-secondary);">${date}</td>
                            </tr>
                        `;
                    }).join("");
                }
            }

            // Loan summary widget
            const loanBox = document.getElementById("cust-loan-summary");
            if (loanBox) {
                const ls = data.loan_summary;
                if (ls.next_due_repayment) {
                    loanBox.innerHTML = `
                        <div style="background: #f8fafc; padding: 14px; border-radius: var(--radius-sm); border-left: 3px solid var(--warning);">
                            <div style="font-size: 13px; font-weight: 600;">Next EMI Installment Due</div>
                            <div style="font-size: 20px; font-weight: 700; color: var(--text-primary); margin: 4px 0;">
                                ₹${parseFloat(ls.next_due_repayment.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                            </div>
                            <div style="font-size: 12px; color: var(--text-muted);">Due Date: ${ls.next_due_repayment.due_date}</div>
                        </div>
                    `;
                } else if (ls.pending_loans > 0) {
                    loanBox.innerHTML = `
                        <div style="padding: 12px; background: #e0f2fe; border-radius: var(--radius-sm); color: #0369a1; font-size: 13px;">
                            You have ${ls.pending_loans} loan application(s) under review by our officers.
                        </div>
                    `;
                } else {
                    loanBox.innerHTML = `
                        <div style="color: var(--text-muted); font-size: 13px;">
                            No active loans. Check our low-interest home, car, or education loan products.
                        </div>
                    `;
                }
            }
        }
    } catch (err) {
        showToast("Error loading dashboard data: " + err.message, "error");
    }
}

async function loadOfficerDashboard() {
    try {
        const res = await api.get("/dashboard/officer/");
        if (res.status === "success") {
            const data = res.data;
            document.getElementById("off-total-customers").textContent = data.total_customers;
            document.getElementById("off-total-accounts").textContent = data.total_accounts;
            document.getElementById("off-total-deposits").textContent = `₹${parseFloat(data.total_deposits).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
            document.getElementById("off-pending-loans").textContent = data.pending_loans;

            const tbody = document.getElementById("off-audit-body");
            if (tbody) {
                if (data.recent_audits.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">No audit logs yet.</td></tr>`;
                } else {
                    tbody.innerHTML = data.recent_audits.map(log => {
                        const date = new Date(log.created_at).toLocaleTimeString("en-IN");
                        return `
                            <tr>
                                <td style="color: var(--text-muted);">${date}</td>
                                <td><strong>${log.actor_username}</strong></td>
                                <td><span class="badge badge-info">${log.action}</span></td>
                                <td><code>${log.entity_type} #${log.entity_id || ''}</code></td>
                            </tr>
                        `;
                    }).join("");
                }
            }
        }
    } catch (err) {
        showToast("Error loading officer data: " + err.message, "error");
    }
}
