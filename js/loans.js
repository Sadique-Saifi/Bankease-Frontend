/**
 * BankEase - Loans Management Page Logic
 * Handles loan products display, loan application submission with officer review,
 * in-person verification (VISIT_REQUIRED), officer decision modals, and EMI repayments.
 */

let allOfficerApplications = [];
let currentFilter = "ALL";
let selectedLoanId = null;

document.addEventListener("DOMContentLoaded", () => {
    const user = api.getUser();
    if (!user) return;

    if (window.lucide) lucide.createIcons();

    if (api.isBankOfficer()) {
        const titleEl = document.getElementById("loans-page-title");
        if (titleEl) titleEl.textContent = "Loan Applications Review Queue";
        document.querySelectorAll(".customer-only").forEach(el => el.classList.add("hidden"));
        const officerSec = document.getElementById("officer-review-section");
        if (officerSec) officerSec.classList.remove("hidden");
        setupFilterTabs();
        loadOfficerLoanQueue();
    } else {
        loadLoanProducts();
        loadMyLoans();
    }

    // Apply loan form submission
    const applyForm = document.getElementById("apply-loan-form");
    if (applyForm) {
        applyForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = document.getElementById("submit-loan-btn");
            btn.disabled = true;
            btn.textContent = "Submitting Application...";

            try {
                const payload = {
                    loan_product_id: parseInt(document.getElementById("apply-product-id").value),
                    requested_amount: document.getElementById("apply-amount").value,
                    duration_months: parseInt(document.getElementById("apply-duration").value),
                };
                const res = await api.post("/loans/applications/", payload);
                const msg = res.message || 
                    "Your loan application has been submitted successfully. Our Bank Officer will review your application and verify the submitted information. You can track your application status from your dashboard.";
                showToast(msg, "success");
                closeApplyModal();
                await loadMyLoans();
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i data-lucide="send"></i> Submit Loan Application';
                if (window.lucide) lucide.createIcons();
            }
        });
    }

    // Officer Confirm Approve
    const confirmApproveBtn = document.getElementById("confirm-approve-loan-btn");
    if (confirmApproveBtn) {
        confirmApproveBtn.addEventListener("click", async () => {
            if (!selectedLoanId) return;
            const remarks = document.getElementById("approve-loan-remarks").value;
            confirmApproveBtn.disabled = true;
            confirmApproveBtn.textContent = "Authorizing...";
            try {
                const res = await api.post(`/loans/applications/${selectedLoanId}/review/`, {
                    action: "APPROVE",
                    officer_remarks: remarks,
                });
                showToast(res.message || `Loan #${selectedLoanId} approved successfully.`, "success");
                closeApproveLoanModal();
                await loadOfficerLoanQueue();
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                confirmApproveBtn.disabled = false;
                confirmApproveBtn.innerHTML = '<i data-lucide="check"></i> Confirm & Authorize Loan';
                if (window.lucide) lucide.createIcons();
            }
        });
    }

    // Officer Confirm Reject
    const confirmRejectBtn = document.getElementById("confirm-reject-loan-btn");
    if (confirmRejectBtn) {
        confirmRejectBtn.addEventListener("click", async () => {
            if (!selectedLoanId) return;
            const reason = document.getElementById("reject-loan-reason").value.trim();
            if (!reason) {
                showToast("Please provide a rejection reason.", "error");
                return;
            }
            confirmRejectBtn.disabled = true;
            confirmRejectBtn.textContent = "Rejecting...";
            try {
                const res = await api.post(`/loans/applications/${selectedLoanId}/review/`, {
                    action: "REJECT",
                    rejection_reason: reason,
                });
                showToast(res.message || `Loan #${selectedLoanId} has been rejected.`, "success");
                closeRejectLoanModal();
                await loadOfficerLoanQueue();
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                confirmRejectBtn.disabled = false;
                confirmRejectBtn.innerHTML = '<i data-lucide="x"></i> Confirm Rejection';
                if (window.lucide) lucide.createIcons();
            }
        });
    }

    // Officer Confirm In-Person Verification Visit
    const confirmVisitBtn = document.getElementById("confirm-visit-loan-btn");
    if (confirmVisitBtn) {
        confirmVisitBtn.addEventListener("click", async () => {
            if (!selectedLoanId) return;
            const instructions = document.getElementById("visit-instructions-input").value.trim();
            if (!instructions) {
                showToast("Please enter verification instructions.", "error");
                return;
            }
            const location = document.getElementById("visit-location-input").value.trim();
            const apptDate = document.getElementById("visit-appointment-input").value;
            const remarks = document.getElementById("visit-remarks-input").value.trim();

            confirmVisitBtn.disabled = true;
            confirmVisitBtn.textContent = "Saving Visit Request...";
            try {
                const payload = {
                    action: "VISIT_REQUIRED",
                    verification_instructions: instructions,
                    visit_location: location,
                    appointment_date: apptDate ? new Date(apptDate).toISOString() : null,
                    officer_remarks: remarks,
                };
                const res = await api.post(`/loans/applications/${selectedLoanId}/review/`, payload);
                showToast(res.message || `In-person visit requested for loan #${selectedLoanId}.`, "success");
                closeVisitLoanModal();
                await loadOfficerLoanQueue();
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                confirmVisitBtn.disabled = false;
                confirmVisitBtn.innerHTML = '<i data-lucide="map-pin"></i> Request Verification Visit';
                if (window.lucide) lucide.createIcons();
            }
        });
    }

    // Repay installment form
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
                showToast("EMI installment paid successfully!", "success");
                closeRepayModal();
                await loadMyLoans();
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i data-lucide="check-circle"></i> Authorize & Pay EMI';
                if (window.lucide) lucide.createIcons();
            }
        });
    }
});

// ---- Filter Tabs for Officer ----
function setupFilterTabs() {
    const tabs = document.querySelectorAll(".loan-filter-btn");
    tabs.forEach(btn => {
        btn.addEventListener("click", () => {
            tabs.forEach(b => {
                b.classList.remove("active");
                b.classList.remove("btn-primary");
                b.classList.add("btn-secondary");
            });
            btn.classList.add("active");
            btn.classList.remove("btn-secondary");
            btn.classList.add("btn-primary");
            currentFilter = btn.dataset.filter;
            renderOfficerTable();
        });
    });
}

// ---- Customer: Load Loan Products ----
async function loadLoanProducts() {
    try {
        const res = await api.get("/loans/products/");
        const products = res.data || res.results || res;
        const grid = document.getElementById("loan-products-grid");
        if (!grid) return;

        if (!Array.isArray(products) || !products.length) {
            grid.innerHTML = '<p style="color: var(--text-muted);">No loan products available at this time.</p>';
            return;
        }

        grid.innerHTML = products.map(p => {
            let icon = "landmark";
            const lower = p.product_name.toLowerCase();
            if (lower.includes("home")) icon = "home";
            else if (lower.includes("car") || lower.includes("vehicle")) icon = "car";
            else if (lower.includes("edu")) icon = "graduation-cap";
            else if (lower.includes("personal")) icon = "user";

            return `
                <div class="card" style="cursor:pointer; display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.2s;" onclick="openApplyModal(${p.id}, '${p.product_name.replace(/'/g, "\\'")}', ${p.minimum_amount}, ${p.maximum_amount}, ${p.interest_rate}, ${p.duration_months})">
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                            <div style="width: 40px; height: 40px; border-radius: 8px; background: #e0f2fe; color: #0369a1; display: flex; align-items: center; justify-content: center;">
                                <i data-lucide="${icon}"></i>
                            </div>
                            <span class="badge badge-info">${p.interest_rate}% p.a.</span>
                        </div>
                        <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 6px;">${p.product_name}</h3>
                        <div style="display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
                            <span>Range: ₹${Number(p.minimum_amount).toLocaleString()} – ₹${Number(p.maximum_amount).toLocaleString()}</span>
                            <span>Max Tenure: ${p.duration_months} months</span>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-sm" style="width: 100%;">
                        <i data-lucide="arrow-right"></i> Apply Now
                    </button>
                </div>
            `;
        }).join("");

        if (window.lucide) lucide.createIcons();
    } catch (err) {
        showToast("Failed to load loan products.", "error");
    }
}

// ---- Customer: Load My Loan Applications ----
async function loadMyLoans() {
    try {
        const res = await api.get("/loans/applications/");
        const apps = res.data || res.results || res;
        const container = document.getElementById("my-loans-container");
        if (!container) return;

        if (!Array.isArray(apps) || !apps.length) {
            container.innerHTML = '<p style="color: var(--text-muted); font-size: 14px;">You have no submitted loan applications yet. Choose a product above to apply.</p>';
            return;
        }

        container.innerHTML = apps.map(app => {
            const statusBadge = getStatusBadge(app.application_status);
            const isVisitReq = app.application_status === "VISIT_REQUIRED";
            const borderCol = app.application_status === 'APPROVED' ? 'var(--accent)' : 
                             app.application_status === 'REJECTED' ? 'var(--danger)' :
                             isVisitReq ? '#7e22ce' : 'var(--warning)';

            // In-person verification block
            let visitBlock = "";
            if (isVisitReq) {
                visitBlock = `
                    <div style="background: #fdf4ff; border: 1px solid #f0abfc; border-radius: var(--radius-sm); padding: 14px; margin: 12px 0;">
                        <div style="display: flex; align-items: center; gap: 6px; color: #7e22ce; font-weight: 700; font-size: 13px; margin-bottom: 6px;">
                            <i data-lucide="map-pin" style="width: 16px; height: 16px;"></i> In-Person Bank Visit Required
                        </div>
                        <p style="font-size: 13px; color: #4c1d95; margin-bottom: 6px;">
                            <strong>Instructions:</strong> ${app.verification_instructions || "Please visit your branch with required identity & income documents."}
                        </p>
                        ${app.visit_location ? `<p style="font-size: 12px; color: #581c87; margin-bottom: 4px;"><strong>Branch Location:</strong> ${app.visit_location}</p>` : ""}
                        ${app.appointment_date ? `<p style="font-size: 12px; color: #581c87; margin-bottom: 4px;"><strong>Appointment Time:</strong> ${new Date(app.appointment_date).toLocaleString("en-IN")}</p>` : ""}
                        ${app.officer_remarks ? `<p style="font-size: 12px; color: #6b21a8; font-style: italic;"><strong>Officer Remarks:</strong> ${app.officer_remarks}</p>` : ""}
                    </div>
                `;
            } else if (app.application_status === "REJECTED" && app.rejection_reason) {
                visitBlock = `
                    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--radius-sm); padding: 10px 14px; margin: 10px 0; font-size: 12px; color: #991b1b;">
                        <strong>Rejection Reason:</strong> ${app.rejection_reason}
                    </div>
                `;
            } else if (app.application_status === "PENDING_REVIEW" || app.application_status === "PENDING") {
                visitBlock = `
                    <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: var(--radius-sm); padding: 8px 12px; margin: 10px 0; font-size: 12px; color: #854d0e; display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="clock" style="width: 14px; height: 14px;"></i> Officer verification in progress. Allow up to 24 hours.
                    </div>
                `;
            }

            const repaymentRows = (app.repayments || []).map(r => `
                <tr>
                    <td>#${r.installment_number}</td>
                    <td>₹${Number(r.amount).toLocaleString("en-IN", {minimumFractionDigits:2})}</td>
                    <td>${new Date(r.due_date).toLocaleDateString()}</td>
                    <td>${getStatusBadge(r.payment_status)}</td>
                    <td>${r.payment_status === "PENDING" ? `<button class="btn btn-success btn-sm" onclick="openRepayModal(${r.id}, '${r.amount}')"><i data-lucide="check"></i> Pay</button>` : "—"}</td>
                </tr>
            `).join("");

            return `
                <div class="card" style="margin-bottom: 16px; border-left: 4px solid ${borderCol};">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <div>
                            <h4 style="font-size: 16px; font-weight: 700; color: var(--text-primary);">${app.product_name} — ₹${Number(app.requested_amount).toLocaleString()}</h4>
                            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                                Application ID: <code>#${app.id}</code> | Interest: ${app.interest_rate}% | Tenure: ${app.duration_months} months | Applied: ${new Date(app.submitted_at).toLocaleDateString()}
                            </div>
                        </div>
                        ${statusBadge}
                    </div>

                    ${visitBlock}

                    ${app.repayments && app.repayments.length ? `
                        <details style="margin-top: 12px;">
                            <summary style="cursor:pointer; font-size: 13px; font-weight: 600; color: var(--primary);">View Repayment Schedule (${app.repayments.length} installments)</summary>
                            <div class="table-responsive" style="margin-top: 10px;">
                                <table class="table">
                                    <thead><tr><th>Installment</th><th>Amount</th><th>Due Date</th><th>Status</th><th>Action</th></tr></thead>
                                    <tbody>${repaymentRows}</tbody>
                                </table>
                            </div>
                        </details>
                    ` : ""}
                </div>
            `;
        }).join("");

        if (window.lucide) lucide.createIcons();
    } catch (err) {
        showToast("Failed to load loan applications: " + err.message, "error");
    }
}

// ---- Officer: Load Loan Queue ----
async function loadOfficerLoanQueue() {
    try {
        const res = await api.get("/loans/applications/");
        allOfficerApplications = res.data || res.results || res;
        if (!Array.isArray(allOfficerApplications)) allOfficerApplications = [];

        // Update counts
        const pending = allOfficerApplications.filter(a => a.application_status === "PENDING" || a.application_status === "PENDING_REVIEW" || a.application_status === "UNDER_REVIEW");
        const visit = allOfficerApplications.filter(a => a.application_status === "VISIT_REQUIRED");
        const approved = allOfficerApplications.filter(a => a.application_status === "APPROVED");
        const rejected = allOfficerApplications.filter(a => a.application_status === "REJECTED");

        document.getElementById("count-all").textContent = allOfficerApplications.length;
        document.getElementById("count-pending").textContent = pending.length;
        document.getElementById("count-visit").textContent = visit.length;
        document.getElementById("count-approved").textContent = approved.length;
        document.getElementById("count-rejected").textContent = rejected.length;

        renderOfficerTable();
    } catch (err) {
        showToast("Failed to load loan queue: " + err.message, "error");
    }
}

function renderOfficerTable() {
    const tbody = document.getElementById("officer-loan-queue-body");
    if (!tbody) return;

    let filtered = allOfficerApplications;
    if (currentFilter === "PENDING") {
        filtered = allOfficerApplications.filter(a => ["PENDING", "PENDING_REVIEW", "UNDER_REVIEW"].includes(a.application_status));
    } else if (currentFilter === "VISIT_REQUIRED") {
        filtered = allOfficerApplications.filter(a => a.application_status === "VISIT_REQUIRED");
    } else if (currentFilter === "APPROVED") {
        filtered = allOfficerApplications.filter(a => a.application_status === "APPROVED");
    } else if (currentFilter === "REJECTED") {
        filtered = allOfficerApplications.filter(a => a.application_status === "REJECTED");
    }

    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--text-muted); padding: 24px;">No applications found matching filter '${currentFilter}'.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(app => {
        const isPending = ["PENDING", "PENDING_REVIEW", "UNDER_REVIEW"].includes(app.application_status);
        const isVisit = app.application_status === "VISIT_REQUIRED";
        const dateStr = new Date(app.submitted_at).toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric"
        });

        let actionButtons = "—";
        if (isPending || isVisit) {
            actionButtons = `
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    <button class="btn btn-success btn-sm" onclick="openApproveLoanModal(${app.id}, '${(app.customer_name || 'Customer').replace(/'/g, "\\'")}', '${app.product_name}', '${app.requested_amount}')">
                        <i data-lucide="check"></i> Approve
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="openRejectLoanModal(${app.id}, '${(app.customer_name || 'Customer').replace(/'/g, "\\'")}')">
                        <i data-lucide="x"></i> Reject
                    </button>
                    ${!isVisit ? `
                    <button class="btn btn-secondary btn-sm" style="border-color:#7e22ce; color:#7e22ce;" onclick="openVisitLoanModal(${app.id}, '${(app.customer_name || 'Customer').replace(/'/g, "\\'")}')">
                        <i data-lucide="map-pin"></i> Visit Required
                    </button>` : `
                    <span class="badge badge-purple" title="${app.verification_instructions || ''}">Visit Pending</span>
                    `}
                </div>
            `;
        } else if (app.application_status === "APPROVED") {
            actionButtons = `<span style="font-size: 11px; color: var(--accent);"><i data-lucide="check-circle" style="width:14px;height:14px;"></i> Active Loan</span>`;
        } else if (app.application_status === "REJECTED") {
            actionButtons = `<span style="font-size: 11px; color: var(--danger);"><i data-lucide="x-circle" style="width:14px;height:14px;"></i> Declined</span>`;
        }

        return `
            <tr>
                <td><code>#${app.id}</code></td>
                <td><strong>${app.customer_name || "N/A"}</strong><br><small style="color:var(--text-muted);">${app.customer_number || ""}</small></td>
                <td>${app.product_name}</td>
                <td style="font-weight: 600;">₹${Number(app.requested_amount).toLocaleString()}</td>
                <td>${app.duration_months} mos</td>
                <td>${getStatusBadge(app.application_status)}</td>
                <td style="color: var(--text-secondary);">${dateStr}</td>
                <td>${actionButtons}</td>
            </tr>
        `;
    }).join("");

    if (window.lucide) lucide.createIcons();
}

// ---- Officer Modals ----
function openApproveLoanModal(id, custName, prodName, amount) {
    selectedLoanId = id;
    document.getElementById("approve-loan-msg").textContent = 
        `Are you sure you want to approve loan #${id} for ${custName} (${prodName} - ₹${Number(amount).toLocaleString()})? Monthly EMI repayment installments will be generated automatically.`;
    document.getElementById("approve-loan-remarks").value = "";
    document.getElementById("approve-loan-modal").classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
}

function closeApproveLoanModal() {
    selectedLoanId = null;
    document.getElementById("approve-loan-modal").classList.add("hidden");
}

function openRejectLoanModal(id, custName) {
    selectedLoanId = id;
    document.getElementById("reject-loan-msg").textContent = 
        `Rejecting loan application #${id} for ${custName}. Please enter the reason for rejection (required):`;
    document.getElementById("reject-loan-reason").value = "";
    document.getElementById("reject-loan-modal").classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
}

function closeRejectLoanModal() {
    selectedLoanId = null;
    document.getElementById("reject-loan-modal").classList.add("hidden");
}

function openVisitLoanModal(id, custName) {
    selectedLoanId = id;
    document.getElementById("visit-loan-msg").textContent = 
        `Request in-person verification for loan #${id} (${custName}). Please provide visit instructions and branch details:`;
    document.getElementById("visit-instructions-input").value = "";
    document.getElementById("visit-location-input").value = "Main Branch, Loan Verification Desk";
    document.getElementById("visit-appointment-input").value = "";
    document.getElementById("visit-remarks-input").value = "";
    document.getElementById("visit-loan-modal").classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
}

function closeVisitLoanModal() {
    selectedLoanId = null;
    document.getElementById("visit-loan-modal").classList.add("hidden");
}

// ---- Modals: Apply Loan ----
function openApplyModal(productId, name, min, max, rate, maxMonths) {
    document.getElementById("apply-product-id").value = productId;
    document.getElementById("apply-modal-title").textContent = `Apply for ${name}`;
    document.getElementById("amount-hint").textContent = `Product limits: ₹${Number(min).toLocaleString()} – ₹${Number(max).toLocaleString()} | Rate: ${rate}% p.a.`;
    const amtInput = document.getElementById("apply-amount");
    amtInput.min = min;
    amtInput.max = max;
    amtInput.value = min;
    const durInput = document.getElementById("apply-duration");
    durInput.max = maxMonths;
    durInput.value = Math.min(24, maxMonths);
    document.getElementById("apply-loan-modal").classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
}

function closeApplyModal() {
    document.getElementById("apply-loan-modal").classList.add("hidden");
    document.getElementById("apply-loan-form").reset();
}

// ---- Modals: Repay EMI ----
async function openRepayModal(repaymentId, amount) {
    document.getElementById("repayment-id-input").value = repaymentId;
    document.getElementById("repay-amount-display").textContent = `₹${Number(amount).toLocaleString("en-IN", {minimumFractionDigits:2})}`;

    const select = document.getElementById("repay-source-account");
    select.innerHTML = '<option value="">Loading accounts...</option>';
    try {
        const res = await api.get("/accounts/");
        const accounts = res.data || res.results || res;
        if (Array.isArray(accounts) && accounts.length) {
            select.innerHTML = accounts.map(a => `<option value="${a.id}">${a.account_number} (₹${Number(a.balance).toLocaleString()})</option>`).join("");
        } else {
            select.innerHTML = '<option value="">No active accounts</option>';
        }
    } catch (err) {
        select.innerHTML = '<option value="">Failed to load</option>';
    }
    document.getElementById("pay-repayment-modal").classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
}

function closeRepayModal() {
    document.getElementById("pay-repayment-modal").classList.add("hidden");
    document.getElementById("pay-repayment-form").reset();
}

// ---- Helpers ----
function getStatusBadge(status) {
    const map = {
        PENDING_REVIEW: "badge-warning",
        PENDING: "badge-warning",
        UNDER_REVIEW: "badge-info",
        VISIT_REQUIRED: "badge-purple",
        APPROVED: "badge-success",
        REJECTED: "badge-danger",
        DISBURSED: "badge-primary",
        PAID: "badge-success",
        OVERDUE: "badge-danger",
    };
    const textMap = {
        PENDING_REVIEW: "Pending Review",
        PENDING: "Pending Review",
        UNDER_REVIEW: "Under Review",
        VISIT_REQUIRED: "Visit Required",
        APPROVED: "Approved",
        REJECTED: "Rejected",
        DISBURSED: "Disbursed",
        PAID: "Paid",
        OVERDUE: "Overdue",
    };
    return `<span class="badge ${map[status] || "badge-secondary"}">${textMap[status] || status}</span>`;
}
