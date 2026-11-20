/**
 * BankEase - Accounts Page Logic
 * Handles customer active accounts, customer account requests history,
 * and officer account request review queue (Approve/Reject).
 */

let selectedRequestId = null;

document.addEventListener("DOMContentLoaded", async () => {
    if (!api.isAuthenticated()) return;

    if (window.lucide) lucide.createIcons();

    const isOfficer = api.isBankOfficer();

    if (isOfficer) {
        document.querySelectorAll(".customer-only").forEach(el => el.classList.add("hidden"));
        const titleEl = document.getElementById("accounts-page-title");
        if (titleEl) titleEl.textContent = "Bank Accounts & Requests Registry";
        
        const officerSec = document.getElementById("officer-accounts-section");
        if (officerSec) officerSec.classList.remove("hidden");

        await loadOfficerAccountRequests();
    } else {
        await loadAccounts();
        await loadCustomerRequests();
    }

    // Modal controls for new account
    const openBtn = document.getElementById("open-modal-btn");
    const modal = document.getElementById("new-account-modal");
    if (openBtn && modal) {
        openBtn.addEventListener("click", () => {
            modal.classList.remove("hidden");
            if (window.lucide) lucide.createIcons();
        });
    }

    // Customer submits account opening request
    const form = document.getElementById("new-account-form");
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById("submit-account-btn");
            submitBtn.disabled = true;
            submitBtn.textContent = "Submitting...";

            const account_type = document.getElementById("new-acc-type").value;
            const initial_deposit = document.getElementById("new-acc-deposit").value;

            try {
                const res = await api.post("/accounts/", { account_type, initial_deposit });
                if (res.status === "success") {
                    const msg = res.message || 
                        "Your account opening request has been submitted successfully. Our Bank Officer will verify your details. Please allow up to 24 hours for the review process. You can track your application status from your dashboard.";
                    showToast(msg, "success");
                    closeModal();
                    form.reset();
                    await loadCustomerRequests();
                }
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i data-lucide="send"></i> Submit Account Opening Request';
                if (window.lucide) lucide.createIcons();
            }
        });
    }

    // Officer confirm approve
    const confirmApproveBtn = document.getElementById("confirm-approve-btn");
    if (confirmApproveBtn) {
        confirmApproveBtn.addEventListener("click", async () => {
            if (!selectedRequestId) return;
            const remarks = document.getElementById("approve-officer-remarks").value;
            confirmApproveBtn.disabled = true;
            confirmApproveBtn.textContent = "Approving...";
            try {
                const res = await api.post(`/account-requests/${selectedRequestId}/review/`, {
                    action: "APPROVE",
                    officer_remarks: remarks,
                });
                showToast(res.message || "Account opening request approved successfully.", "success");
                closeApproveModal();
                await loadOfficerAccountRequests();
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                confirmApproveBtn.disabled = false;
                confirmApproveBtn.innerHTML = '<i data-lucide="check"></i> Confirm & Activate Account';
                if (window.lucide) lucide.createIcons();
            }
        });
    }

    // Officer confirm reject
    const confirmRejectBtn = document.getElementById("confirm-reject-btn");
    if (confirmRejectBtn) {
        confirmRejectBtn.addEventListener("click", async () => {
            if (!selectedRequestId) return;
            const reason = document.getElementById("reject-reason-input").value.trim();
            if (!reason) {
                showToast("Please provide a rejection reason.", "error");
                return;
            }
            confirmRejectBtn.disabled = true;
            confirmRejectBtn.textContent = "Rejecting...";
            try {
                const res = await api.post(`/account-requests/${selectedRequestId}/review/`, {
                    action: "REJECT",
                    rejection_reason: reason,
                });
                showToast(res.message || "Account opening request rejected.", "success");
                closeRejectModal();
                await loadOfficerAccountRequests();
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                confirmRejectBtn.disabled = false;
                confirmRejectBtn.innerHTML = '<i data-lucide="x"></i> Confirm Rejection';
                if (window.lucide) lucide.createIcons();
            }
        });
    }
});

function closeModal() {
    const modal = document.getElementById("new-account-modal");
    if (modal) modal.classList.add("hidden");
}

function openApproveModal(id, customerName, accType) {
    selectedRequestId = id;
    document.getElementById("approve-modal-msg").textContent = 
        `Are you sure you want to approve request #${id} for ${customerName} (${accType})? A new bank account will be generated and activated immediately.`;
    document.getElementById("approve-officer-remarks").value = "";
    document.getElementById("approve-account-modal").classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
}

function closeApproveModal() {
    selectedRequestId = null;
    document.getElementById("approve-account-modal").classList.add("hidden");
}

function openRejectModal(id, customerName) {
    selectedRequestId = id;
    document.getElementById("reject-modal-msg").textContent = 
        `Rejecting account request #${id} for ${customerName}. Please specify the reason for rejection (required):`;
    document.getElementById("reject-reason-input").value = "";
    document.getElementById("reject-account-modal").classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
}

function closeRejectModal() {
    selectedRequestId = null;
    document.getElementById("reject-account-modal").classList.add("hidden");
}

// ---- Customer: Load Active Accounts ----
async function loadAccounts() {
    const grid = document.getElementById("accounts-grid");
    if (!grid) return;

    try {
        const res = await api.get("/accounts/");
        const accounts = res.data || res.results || res;

        if (!Array.isArray(accounts) || accounts.length === 0) {
            grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1; padding: 32px; text-align: center; background: white; border-radius: var(--radius); border: 1px dashed var(--border);">
                <i data-lucide="credit-card" style="width: 36px; height: 36px; color: var(--text-muted); margin-bottom: 8px;"></i>
                <p style="color: var(--text-secondary); font-size: 14px;">No active bank accounts found. Click 'Open New Account' above to request one.</p>
            </div>`;
            if (window.lucide) lucide.createIcons();
            return;
        }

        grid.innerHTML = accounts.map(acc => {
            const statusBadge = acc.account_status === "ACTIVE" ? "badge-success" : "badge-danger";
            const isSavings = acc.account_type === "SAVINGS";
            const iconName = isSavings ? "landmark" : (acc.account_type === "CURRENT" ? "briefcase" : "piggy-bank");
            return `
                <div class="card" style="border-top: 4px solid ${isSavings ? '#2563eb' : '#0d9488'}; position: relative;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                        <div>
                            <span class="badge ${statusBadge}">${acc.account_status_display}</span>
                            <h3 style="font-size: 18px; margin-top: 8px; font-weight: 700;">${acc.account_type_display}</h3>
                        </div>
                        <div style="width: 40px; height: 40px; border-radius: 8px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: var(--primary);">
                            <i data-lucide="${iconName}"></i>
                        </div>
                    </div>

                    <div style="color: var(--text-muted); font-size: 13px; font-family: monospace; letter-spacing: 1px;">
                        A/C: ${acc.account_number}
                    </div>

                    <div style="margin: 20px 0;">
                        <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Available Balance</div>
                        <div style="font-size: 28px; font-weight: 800; color: var(--text-primary); margin-top: 2px;">
                            ₹${parseFloat(acc.balance).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                        </div>
                    </div>

                    <div style="display: flex; gap: 8px; border-top: 1px solid var(--border); padding-top: 16px;">
                        <a href="transfer.html?source=${acc.id}" class="btn btn-primary btn-sm btn-block">
                            <i data-lucide="send"></i> Transfer
                        </a>
                        <a href="transactions.html?account_id=${acc.id}" class="btn btn-secondary btn-sm btn-block">
                            <i data-lucide="receipt"></i> Statement
                        </a>
                    </div>
                </div>
            `;
        }).join("");

        if (window.lucide) lucide.createIcons();
    } catch (err) {
        showToast("Error loading accounts: " + err.message, "error");
    }
}

// ---- Customer: Load My Submitted Requests ----
async function loadCustomerRequests() {
    const tbody = document.getElementById("customer-requests-body");
    if (!tbody) return;

    try {
        const res = await api.get("/account-requests/");
        const reqs = res.data || res.results || res;

        if (!Array.isArray(reqs) || reqs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No account opening requests submitted yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = reqs.map(r => {
            const badgeClass = r.status === "APPROVED" ? "badge-success" : 
                              r.status === "REJECTED" ? "badge-danger" : "badge-warning";
            const dateStr = new Date(r.created_at).toLocaleDateString("en-IN", {
                day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
            });
            let detail = "—";
            if (r.status === "APPROVED" && r.created_account_number) {
                detail = `<span style="color: var(--accent); font-weight: 600;">Account: ${r.created_account_number}</span>`;
            } else if (r.status === "REJECTED" && r.rejection_reason) {
                detail = `<span style="color: var(--danger); font-size: 12px;">Reason: ${r.rejection_reason}</span>`;
            } else if (r.status === "PENDING_REVIEW") {
                detail = `<span style="color: var(--warning); font-size: 12px;"><i data-lucide="clock" style="width:12px;height:12px;"></i> Verification in progress (up to 24h)</span>`;
            }

            return `
                <tr>
                    <td><code>#${r.id}</code></td>
                    <td><strong>${r.account_type_display}</strong></td>
                    <td>₹${parseFloat(r.initial_deposit).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                    <td><span class="badge ${badgeClass}">${r.status_display}</span></td>
                    <td style="color: var(--text-secondary);">${dateStr}</td>
                    <td>${detail}</td>
                </tr>
            `;
        }).join("");

        if (window.lucide) lucide.createIcons();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--danger);">Failed to load requests: ${err.message}</td></tr>`;
    }
}

// ---- Officer: Load All Requests Queue ----
async function loadOfficerAccountRequests() {
    const pendingTbody = document.getElementById("officer-account-requests-body");
    const reviewedTbody = document.getElementById("officer-reviewed-requests-body");
    const pendingBadge = document.getElementById("officer-pending-badge");

    try {
        const res = await api.get("/account-requests/");
        const allReqs = res.data || res.results || res;

        if (!Array.isArray(allReqs)) return;

        const pending = allReqs.filter(r => r.status === "PENDING_REVIEW");
        const reviewed = allReqs.filter(r => r.status !== "PENDING_REVIEW");

        if (pendingBadge) {
            pendingBadge.textContent = `${pending.length} Pending`;
            pendingBadge.className = `badge ${pending.length > 0 ? 'badge-warning' : 'badge-success'}`;
        }

        // Render Pending Requests
        if (pendingTbody) {
            if (pending.length === 0) {
                pendingTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">No pending account opening requests requiring review.</td></tr>`;
            } else {
                pendingTbody.innerHTML = pending.map(r => {
                    const dateStr = new Date(r.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                    });
                    const custName = r.requested_by_name || r.requested_by_username;
                    return `
                        <tr>
                            <td><code>#${r.id}</code></td>
                            <td><strong>${custName}</strong></td>
                            <td><code>${r.customer_number || 'N/A'}</code></td>
                            <td><span class="badge badge-info">${r.account_type_display}</span></td>
                            <td style="font-weight: 600;">₹${parseFloat(r.initial_deposit).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                            <td style="color: var(--text-secondary);">${dateStr}</td>
                            <td>
                                <div style="display: flex; gap: 8px;">
                                    <button class="btn btn-success btn-sm" onclick="openApproveModal(${r.id}, '${custName.replace(/'/g, "\\'")}', '${r.account_type_display}')">
                                        <i data-lucide="check"></i> Approve
                                    </button>
                                    <button class="btn btn-danger btn-sm" onclick="openRejectModal(${r.id}, '${custName.replace(/'/g, "\\'")}')">
                                        <i data-lucide="x"></i> Reject
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join("");
            }
        }

        // Render Reviewed Requests
        if (reviewedTbody) {
            if (reviewed.length === 0) {
                reviewedTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No previously processed requests.</td></tr>`;
            } else {
                reviewedTbody.innerHTML = reviewed.map(r => {
                    const badgeClass = r.status === "APPROVED" ? "badge-success" : "badge-danger";
                    const dateStr = r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric"
                    }) : "—";
                    const remarks = r.status === "APPROVED" ? 
                        `Acc: ${r.created_account_number || 'Created'} ${r.officer_remarks ? '— ' + r.officer_remarks : ''}` :
                        `Reason: ${r.rejection_reason || 'N/A'}`;

                    return `
                        <tr>
                            <td><code>#${r.id}</code></td>
                            <td>${r.requested_by_name || r.requested_by_username}</td>
                            <td>${r.account_type_display}</td>
                            <td>₹${parseFloat(r.initial_deposit).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                            <td><span class="badge ${badgeClass}">${r.status_display}</span></td>
                            <td style="color: var(--text-secondary);">${dateStr}</td>
                            <td style="font-size: 12px; color: var(--text-secondary);">${remarks}</td>
                        </tr>
                    `;
                }).join("");
            }
        }

        if (window.lucide) lucide.createIcons();
    } catch (err) {
        showToast("Failed to load officer requests: " + err.message, "error");
    }
}
