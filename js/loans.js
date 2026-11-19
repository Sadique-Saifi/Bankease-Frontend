/**
 * BankEase - Loans Management Page Logic
 * Handles loan products display, loan application, officer review, and EMI repayment.
 */

document.addEventListener("DOMContentLoaded", () => {
    const user = api.getUser();
    if (!user) return;

    if (api.isBankOfficer()) {
        const titleEl = document.getElementById("loans-page-title");
        if (titleEl) titleEl.textContent = "Loan Applications Review";
        document.querySelectorAll(".customer-only").forEach(el => el.classList.add("hidden"));
        const officerSec = document.getElementById("officer-review-section");
        if (officerSec) officerSec.classList.remove("hidden");
        loadOfficerLoanQueue();
    } else {
        loadLoanProducts();
        loadMyLoans();
    }

    // Apply loan form
    const applyForm = document.getElementById("apply-loan-form");
    if (applyForm) {
        applyForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = applyForm.querySelector("button[type='submit']");
            btn.disabled = true;
            btn.textContent = "Submitting...";

            try {
                const payload = {
                    loan_product_id: parseInt(document.getElementById("apply-product-id").value),
                    requested_amount: document.getElementById("apply-amount").value,
                    duration_months: parseInt(document.getElementById("apply-duration").value),
                };
                await api.post("/loans/applications/", payload);
                showToast("Loan application submitted successfully!", "success");
                closeApplyModal();
                loadMyLoans();
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                btn.disabled = false;
                btn.textContent = "Submit Loan Application";
            }
        });
    }

    // Repay form
    const repayForm = document.getElementById("pay-repayment-form");
    if (repayForm) {
        repayForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = repayForm.querySelector("button[type='submit']");
            btn.disabled = true;
            btn.textContent = "Processing...";

            try {
                const repaymentId = document.getElementById("repayment-id-input").value;
                const accountId = document.getElementById("repay-source-account").value;
                await api.post(`/loans/repayments/${repaymentId}/pay/`, { account_id: parseInt(accountId) });
                showToast("EMI payment processed successfully!", "success");
                closeRepayModal();
                loadMyLoans();
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                btn.disabled = false;
                btn.textContent = "Authorize & Pay EMI";
            }
        });
    }
});

// ---- Loan Products ----
async function loadLoanProducts() {
    try {
        const res = await api.get("/loans/products/");
        const products = res.results || res;
        const grid = document.getElementById("loan-products-grid");
        if (!grid) return;
        if (!products.length) {
            grid.innerHTML = '<p style="color: var(--text-muted);">No loan products available.</p>';
            return;
        }
        grid.innerHTML = products.map(p => `
            <div class="card" style="cursor:pointer;" onclick="openApplyModal(${p.id}, '${p.product_name}', ${p.minimum_amount}, ${p.maximum_amount}, ${p.interest_rate}, ${p.duration_months})">
                <div style="padding: 20px;">
                    <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">${p.product_name}</h3>
                    <div style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--text-secondary);">
                        <span>Interest Rate: <strong style="color: var(--primary);">${p.interest_rate}% p.a.</strong></span>
                        <span>Amount Range: ₹${Number(p.minimum_amount).toLocaleString()} – ₹${Number(p.maximum_amount).toLocaleString()}</span>
                        <span>Max Tenure: ${p.duration_months} months</span>
                    </div>
                    <button class="btn btn-primary btn-sm" style="margin-top: 14px; width: 100%;">Apply Now →</button>
                </div>
            </div>
        `).join("");
    } catch (err) {
        showToast("Failed to load loan products.", "error");
    }
}

// ---- My Loan Applications ----
async function loadMyLoans() {
    try {
        const res = await api.get("/loans/applications/");
        const apps = res.results || res;
        const container = document.getElementById("my-loans-container");
        if (!container) return;
        if (!apps.length) {
            container.innerHTML = '<p style="color: var(--text-muted); font-size: 14px;">You have no loan applications yet. Apply for a loan above!</p>';
            return;
        }
        container.innerHTML = apps.map(app => {
            const statusBadge = getStatusBadge(app.application_status);
            const repaymentRows = (app.repayments || []).map(r => `
                <tr>
                    <td>${r.installment_number}</td>
                    <td>₹${Number(r.amount).toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
                    <td>${new Date(r.due_date).toLocaleDateString()}</td>
                    <td>${getStatusBadge(r.payment_status)}</td>
                    <td>${r.payment_status === "PENDING" ? `<button class="btn btn-success btn-sm" onclick="openRepayModal(${r.id}, '${r.amount}')">Pay</button>` : "—"}</td>
                </tr>
            `).join("");

            return `
                <div class="card" style="margin-bottom: 16px; border-left: 4px solid ${app.application_status === 'APPROVED' ? 'var(--success)' : app.application_status === 'REJECTED' ? 'var(--danger)' : 'var(--warning)'};">
                    <div style="padding: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <h4 style="font-size: 15px; font-weight: 700;">${app.product_name} — ₹${Number(app.requested_amount).toLocaleString()}</h4>
                            ${statusBadge}
                        </div>
                        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 10px;">
                            Interest: ${app.interest_rate}% | Tenure: ${app.duration_months} months | Applied: ${new Date(app.submitted_at).toLocaleDateString()}
                        </div>
                        ${app.repayments && app.repayments.length ? `
                            <details>
                                <summary style="cursor:pointer; font-size: 13px; font-weight: 600; color: var(--primary);">View Repayment Schedule (${app.repayments.length} installments)</summary>
                                <div class="table-responsive" style="margin-top: 10px;">
                                    <table class="table">
                                        <thead><tr><th>#</th><th>Amount</th><th>Due Date</th><th>Status</th><th>Action</th></tr></thead>
                                        <tbody>${repaymentRows}</tbody>
                                    </table>
                                </div>
                            </details>
                        ` : ""}
                    </div>
                </div>
            `;
        }).join("");
    } catch (err) {
        showToast("Failed to load loan applications.", "error");
    }
}

// ---- Officer: Loan Queue ----
async function loadOfficerLoanQueue() {
    try {
        const res = await api.get("/loans/applications/");
        const apps = res.results || res;
        const tbody = document.getElementById("officer-loan-queue-body");
        if (!tbody) return;
        if (!apps.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No loan applications found.</td></tr>';
            return;
        }
        tbody.innerHTML = apps.map(app => `
            <tr>
                <td>#${app.id}</td>
                <td>${app.customer_name || "N/A"} <br><small>${app.customer_number || ""}</small></td>
                <td>${app.product_name}</td>
                <td>₹${Number(app.requested_amount).toLocaleString()}</td>
                <td>${app.duration_months} months</td>
                <td>${getStatusBadge(app.application_status)}</td>
                <td>
                    ${app.application_status === "PENDING" ? `
                        <button class="btn btn-success btn-sm" onclick="reviewLoan(${app.id}, 'APPROVE')">Approve</button>
                        <button class="btn btn-danger btn-sm" onclick="reviewLoan(${app.id}, 'REJECT')">Reject</button>
                    ` : "—"}
                </td>
            </tr>
        `).join("");
    } catch (err) {
        showToast("Failed to load loan queue.", "error");
    }
}

async function reviewLoan(appId, action) {
    if (!confirm(`Are you sure you want to ${action} loan application #${appId}?`)) return;
    try {
        await api.post(`/loans/applications/${appId}/review/`, { action });
        showToast(`Loan application ${action.toLowerCase()}d successfully.`, "success");
        loadOfficerLoanQueue();
    } catch (err) {
        showToast(err.message, "error");
    }
}

// ---- Modals ----
function openApplyModal(productId, name, min, max, rate, maxMonths) {
    document.getElementById("apply-product-id").value = productId;
    document.getElementById("apply-modal-title").textContent = `Apply for ${name}`;
    document.getElementById("amount-hint").textContent = `Min: ₹${Number(min).toLocaleString()} — Max: ₹${Number(max).toLocaleString()} | Rate: ${rate}% p.a.`;
    document.getElementById("apply-amount").min = min;
    document.getElementById("apply-amount").max = max;
    document.getElementById("apply-duration").max = maxMonths;
    document.getElementById("apply-loan-modal").classList.remove("hidden");
}

function closeApplyModal() {
    document.getElementById("apply-loan-modal").classList.add("hidden");
    document.getElementById("apply-loan-form").reset();
}

async function openRepayModal(repaymentId, amount) {
    document.getElementById("repayment-id-input").value = repaymentId;
    document.getElementById("repay-amount-display").textContent = `₹${Number(amount).toLocaleString("en-IN", {minimumFractionDigits:2})}`;

    const select = document.getElementById("repay-source-account");
    select.innerHTML = '<option value="">Loading accounts...</option>';
    try {
        const res = await api.get("/accounts/");
        const accounts = res.results || res;
        select.innerHTML = accounts.map(a => `<option value="${a.id}">${a.account_number} (₹${Number(a.balance).toLocaleString()})</option>`).join("");
    } catch (err) {
        select.innerHTML = '<option value="">Failed to load</option>';
    }
    document.getElementById("pay-repayment-modal").classList.remove("hidden");
}

function closeRepayModal() {
    document.getElementById("pay-repayment-modal").classList.add("hidden");
    document.getElementById("pay-repayment-form").reset();
}

// ---- Helpers ----
function getStatusBadge(status) {
    const map = {
        PENDING: "badge-warning",
        APPROVED: "badge-success",
        REJECTED: "badge-danger",
        COMPLETED: "badge-info",
        PAID: "badge-success",
        OVERDUE: "badge-danger",
    };
    return `<span class="badge ${map[status] || "badge-secondary"}">${status}</span>`;
}
