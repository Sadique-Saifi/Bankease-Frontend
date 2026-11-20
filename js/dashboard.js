/**
 * BankEase - Dashboard Logic (Customer & Officer View Switching)
 * Displays account opening requests status, loan applications status,
 * in-person verification notifications, and officer management queues.
 */

let dashSelectedAccountId = null;

document.addEventListener("DOMContentLoaded", async () => {
    if (!api.isAuthenticated()) return;

    if (window.lucide) lucide.createIcons();

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
        setupOfficerDashModals();
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

            // In-Person Visit Alert Banner
            const visitLoan = (data.loan_applications || []).find(l => l.application_status === "VISIT_REQUIRED");
            const visitAlert = document.getElementById("cust-visit-alert");
            if (visitAlert) {
                if (visitLoan) {
                    visitAlert.classList.remove("hidden");
                    const alertText = document.getElementById("cust-visit-alert-text");
                    alertText.innerHTML = `<strong>Loan #${visitLoan.id} (${visitLoan.product_name})</strong> requires an in-person branch verification visit. ${visitLoan.verification_instructions || ''} ${visitLoan.visit_location ? 'Location: ' + visitLoan.visit_location : ''}`;
                } else {
                    visitAlert.classList.add("hidden");
                }
            }

            // Account Opening Requests widget
            const acctReqBox = document.getElementById("cust-account-requests-box");
            if (acctReqBox) {
                const reqs = data.account_opening_requests || [];
                if (reqs.length === 0) {
                    acctReqBox.innerHTML = `
                        <div style="color: var(--text-muted); font-size: 13px; padding: 12px 0;">
                            No pending account opening requests. Need another account? Click <strong>New Request</strong> above.
                        </div>
                    `;
                } else {
                    acctReqBox.innerHTML = reqs.map(r => {
                        const badgeClass = r.status === "APPROVED" ? "badge-success" : 
                                          r.status === "REJECTED" ? "badge-danger" : "badge-warning";
                        const dateStr = new Date(r.created_at).toLocaleDateString("en-IN", {
                            day: "2-digit", month: "short"
                        });
                        let detailMsg = "";
                        if (r.status === "APPROVED" && r.created_account_number) {
                            detailMsg = `<div style="font-size: 11px; color: var(--accent); margin-top: 2px;">Active Account: <code>${r.created_account_number}</code></div>`;
                        } else if (r.status === "REJECTED" && r.rejection_reason) {
                            detailMsg = `<div style="font-size: 11px; color: var(--danger); margin-top: 2px;">Reason: ${r.rejection_reason}</div>`;
                        } else if (r.status === "PENDING_REVIEW") {
                            detailMsg = `<div style="font-size: 11px; color: var(--warning); margin-top: 2px;">Officer verification in progress (allow up to 24 hours)</div>`;
                        }

                        return `
                            <div style="border-bottom: 1px solid var(--border-light); padding: 10px 0;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <strong style="font-size: 13px;">${r.account_type_display}</strong>
                                        <span style="font-size: 12px; color: var(--text-muted); margin-left: 6px;">₹${parseFloat(r.initial_deposit).toLocaleString('en-IN')}</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span style="font-size: 11px; color: var(--text-muted);">${dateStr}</span>
                                        <span class="badge ${badgeClass}">${r.status_display}</span>
                                    </div>
                                </div>
                                ${detailMsg}
                            </div>
                        `;
                    }).join("");
                }
            }

            // Loan summary widget
            const loanBox = document.getElementById("cust-loan-summary");
            if (loanBox) {
                const ls = data.loan_summary;
                const loanApps = data.loan_applications || [];

                if (loanApps.length > 0) {
                    loanBox.innerHTML = loanApps.map(app => {
                        const badgeClass = getLoanBadgeClass(app.application_status);
                        const statusText = getLoanStatusText(app.application_status);
                        const dateStr = new Date(app.submitted_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

                        let note = "";
                        if (app.application_status === "VISIT_REQUIRED") {
                            note = `<div style="font-size: 11px; color: #7e22ce; margin-top: 2px;">Visit required: ${app.verification_instructions || 'Check with branch'}</div>`;
                        } else if (app.application_status === "REJECTED" && app.rejection_reason) {
                            note = `<div style="font-size: 11px; color: var(--danger); margin-top: 2px;">Declined: ${app.rejection_reason}</div>`;
                        } else if (app.application_status === "PENDING_REVIEW" || app.application_status === "PENDING") {
                            note = `<div style="font-size: 11px; color: var(--warning); margin-top: 2px;">Under officer review (up to 24 hours)</div>`;
                        }

                        return `
                            <div style="border-bottom: 1px solid var(--border-light); padding: 10px 0;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <strong style="font-size: 13px;">${app.product_name}</strong>
                                        <span style="font-size: 12px; color: var(--text-muted); margin-left: 6px;">₹${Number(app.requested_amount).toLocaleString()} (${app.duration_months}m)</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span style="font-size: 11px; color: var(--text-muted);">${dateStr}</span>
                                        <span class="badge ${badgeClass}">${statusText}</span>
                                    </div>
                                </div>
                                ${note}
                            </div>
                        `;
                    }).join("");
                } else {
                    loanBox.innerHTML = `
                        <div style="color: var(--text-muted); font-size: 13px; padding: 12px 0;">
                            No active loans or submitted applications. Check our low-interest home, car, or education loan products.
                        </div>
                    `;
                }
            }

            // Recent Transactions Table
            const tbody = document.getElementById("cust-transactions-body");
            if (tbody) {
                if (!data.recent_transactions || data.recent_transactions.length === 0) {
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

            if (window.lucide) lucide.createIcons();
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
            document.getElementById("off-pending-accounts").textContent = data.pending_account_requests || 0;
            document.getElementById("off-pending-loans").textContent = data.pending_loans || 0;
            document.getElementById("off-visit-loans").textContent = data.visit_required_loans || 0;

            // Pending Account Requests Table
            const acctTbody = document.getElementById("off-pending-accounts-body");
            if (acctTbody) {
                const pendingAccts = data.pending_account_requests_list || [];
                if (pendingAccts.length === 0) {
                    acctTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding: 16px;">No pending account opening requests.</td></tr>`;
                } else {
                    acctTbody.innerHTML = pendingAccts.map(r => {
                        const dateStr = new Date(r.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
                        const name = r.requested_by_name || r.requested_by_username;
                        return `
                            <tr>
                                <td><code>#${r.id}</code></td>
                                <td><strong>${name}</strong></td>
                                <td><span class="badge badge-info">${r.account_type_display}</span></td>
                                <td>₹${parseFloat(r.initial_deposit).toLocaleString('en-IN')}</td>
                                <td style="color:var(--text-secondary);">${dateStr}</td>
                                <td>
                                    <div style="display:flex; gap:6px;">
                                        <button class="btn btn-success btn-sm" onclick="openDashApproveAccModal(${r.id}, '${name.replace(/'/g, "\\'")}', '${r.account_type_display}')">
                                            <i data-lucide="check"></i> Approve
                                        </button>
                                        <button class="btn btn-danger btn-sm" onclick="openDashRejectAccModal(${r.id}, '${name.replace(/'/g, "\\'")}')">
                                            <i data-lucide="x"></i> Reject
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join("");
                }
            }

            // Pending Loan Applications Table
            const loanTbody = document.getElementById("off-pending-loans-body");
            if (loanTbody) {
                const pendingLoans = data.pending_loan_applications_list || [];
                if (pendingLoans.length === 0) {
                    loanTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding: 16px;">No pending loan applications requiring review.</td></tr>`;
                } else {
                    loanTbody.innerHTML = pendingLoans.map(app => {
                        const dateStr = new Date(app.submitted_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
                        const badgeClass = getLoanBadgeClass(app.application_status);
                        const statusText = getLoanStatusText(app.application_status);
                        return `
                            <tr>
                                <td><code>#${app.id}</code></td>
                                <td><strong>${app.customer_name || 'N/A'}</strong></td>
                                <td>${app.product_name}</td>
                                <td>₹${Number(app.requested_amount).toLocaleString()}</td>
                                <td><span class="badge ${badgeClass}">${statusText}</span></td>
                                <td style="color:var(--text-secondary);">${dateStr}</td>
                                <td>
                                    <a href="loans.html" class="btn btn-primary btn-sm">
                                        <i data-lucide="external-link"></i> Review
                                    </a>
                                </td>
                            </tr>
                        `;
                    }).join("");
                }
            }

            // Recent Audit Trail Table
            const tbody = document.getElementById("off-audit-body");
            if (tbody) {
                if (!data.recent_audits || data.recent_audits.length === 0) {
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

            if (window.lucide) lucide.createIcons();
        }
    } catch (err) {
        showToast("Error loading officer data: " + err.message, "error");
    }
}

// ---- Officer Dashboard Quick Actions for Account Requests ----
function setupOfficerDashModals() {
    const confirmApproveBtn = document.getElementById("dash-confirm-approve-acc-btn");
    if (confirmApproveBtn) {
        confirmApproveBtn.addEventListener("click", async () => {
            if (!dashSelectedAccountId) return;
            const remarks = document.getElementById("dash-approve-acc-remarks").value;
            confirmApproveBtn.disabled = true;
            confirmApproveBtn.textContent = "Activating...";
            try {
                const res = await api.post(`/account-requests/${dashSelectedAccountId}/review/`, {
                    action: "APPROVE",
                    officer_remarks: remarks,
                });
                showToast(res.message || "Account opening request approved.", "success");
                closeDashApproveAccModal();
                await loadOfficerDashboard();
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                confirmApproveBtn.disabled = false;
                confirmApproveBtn.innerHTML = '<i data-lucide="check"></i> Confirm & Activate';
                if (window.lucide) lucide.createIcons();
            }
        });
    }

    const confirmRejectBtn = document.getElementById("dash-confirm-reject-acc-btn");
    if (confirmRejectBtn) {
        confirmRejectBtn.addEventListener("click", async () => {
            if (!dashSelectedAccountId) return;
            const reason = document.getElementById("dash-reject-acc-reason").value.trim();
            if (!reason) {
                showToast("Please provide a rejection reason.", "error");
                return;
            }
            confirmRejectBtn.disabled = true;
            confirmRejectBtn.textContent = "Rejecting...";
            try {
                const res = await api.post(`/account-requests/${dashSelectedAccountId}/review/`, {
                    action: "REJECT",
                    rejection_reason: reason,
                });
                showToast(res.message || "Account opening request declined.", "success");
                closeDashRejectAccModal();
                await loadOfficerDashboard();
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                confirmRejectBtn.disabled = false;
                confirmRejectBtn.innerHTML = '<i data-lucide="x"></i> Confirm Rejection';
                if (window.lucide) lucide.createIcons();
            }
        });
    }
}

function openDashApproveAccModal(id, name, type) {
    dashSelectedAccountId = id;
    document.getElementById("dash-approve-acc-msg").textContent = 
        `Approve account opening request #${id} for ${name} (${type})? A new bank account will be generated.`;
    document.getElementById("dash-approve-acc-remarks").value = "";
    document.getElementById("dash-approve-acc-modal").classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
}

function closeDashApproveAccModal() {
    dashSelectedAccountId = null;
    document.getElementById("dash-approve-acc-modal").classList.add("hidden");
}

function openDashRejectAccModal(id, name) {
    dashSelectedAccountId = id;
    document.getElementById("dash-reject-acc-msg").textContent = 
        `Declining request #${id} for ${name}. State reason for rejection:`;
    document.getElementById("dash-reject-acc-reason").value = "";
    document.getElementById("dash-reject-acc-modal").classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
}

function closeDashRejectAccModal() {
    dashSelectedAccountId = null;
    document.getElementById("dash-reject-acc-modal").classList.add("hidden");
}

function getLoanBadgeClass(st) {
    if (st === "APPROVED") return "badge-success";
    if (st === "REJECTED") return "badge-danger";
    if (st === "VISIT_REQUIRED") return "badge-purple";
    if (st === "UNDER_REVIEW") return "badge-info";
    return "badge-warning";
}

function getLoanStatusText(st) {
    if (st === "PENDING_REVIEW" || st === "PENDING") return "Pending Review";
    if (st === "UNDER_REVIEW") return "Under Review";
    if (st === "VISIT_REQUIRED") return "Visit Required";
    if (st === "APPROVED") return "Approved";
    if (st === "REJECTED") return "Rejected";
    return st;
}
