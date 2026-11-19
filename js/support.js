/**
 * BankEase - Support Page Logic
 * Handles ticket creation, listing, detail view, messaging, and officer status updates.
 */

let currentTicketId = null;

document.addEventListener("DOMContentLoaded", () => {
    const user = api.getUser();
    if (!user) return;

    if (api.isBankOfficer()) {
        const titleEl = document.getElementById("tickets-list-title");
        if (titleEl) titleEl.textContent = "All Support Tickets";
        document.querySelectorAll(".customer-only").forEach(el => el.classList.add("hidden"));
    }

    loadTickets();

    const createForm = document.getElementById("create-ticket-form");
    if (createForm) {
        createForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = createForm.querySelector("button[type='submit']");
            btn.disabled = true;
            btn.textContent = "Submitting...";

            try {
                await api.post("/support/tickets/", {
                    subject: document.getElementById("ticket-subject").value.trim(),
                    description: document.getElementById("ticket-description").value.trim(),
                    priority: document.getElementById("ticket-priority").value,
                });
                showToast("Support ticket created!", "success");
                createForm.reset();
                loadTickets();
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                btn.disabled = false;
                btn.textContent = "Submit Ticket";
            }
        });
    }

    const replyForm = document.getElementById("reply-form");
    if (replyForm) {
        replyForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!currentTicketId) return;
            const msgInput = document.getElementById("reply-message");
            const message = msgInput.value.trim();
            if (!message) return;

            try {
                await api.post(`/support/tickets/${currentTicketId}/messages/`, { message });
                msgInput.value = "";
                showToast("Reply sent.", "success");
                openTicketDetail(currentTicketId);
            } catch (err) {
                showToast(err.message, "error");
            }
        });
    }
});

async function loadTickets() {
    try {
        const res = await api.get("/support/tickets/");
        const tickets = res.results || res;
        const tbody = document.getElementById("tickets-body");
        if (!tbody) return;
        if (!tickets.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">No support tickets found.</td></tr>';
            return;
        }
        tbody.innerHTML = tickets.map(t => {
            const prioClass = { LOW: "badge-info", MEDIUM: "badge-warning", HIGH: "badge-danger" };
            const statusClass = { OPEN: "badge-primary", IN_PROGRESS: "badge-warning", RESOLVED: "badge-success", CLOSED: "badge-secondary" };
            return `
                <tr>
                    <td>#${t.id}</td>
                    <td>${t.subject}</td>
                    <td><span class="badge ${prioClass[t.priority] || 'badge-secondary'}">${t.priority}</span></td>
                    <td><span class="badge ${statusClass[t.ticket_status] || 'badge-secondary'}">${t.ticket_status.replace("_", " ")}</span></td>
                    <td>${new Date(t.created_at).toLocaleDateString()}</td>
                    <td><button class="btn btn-secondary btn-sm" onclick="openTicketDetail(${t.id})">View</button></td>
                </tr>
            `;
        }).join("");
    } catch (err) {
        showToast("Failed to load tickets.", "error");
    }
}

async function openTicketDetail(ticketId) {
    currentTicketId = ticketId;
    try {
        const ticket = await api.get(`/support/tickets/${ticketId}/`);
        document.getElementById("detail-ticket-title").textContent = `#${ticket.id}: ${ticket.subject}`;
        document.getElementById("detail-ticket-meta").innerHTML = `
            <strong>Customer:</strong> ${ticket.customer_name || "N/A"} |
            <strong>Priority:</strong> ${ticket.priority} |
            <strong>Status:</strong> ${ticket.ticket_status.replace("_", " ")} |
            <strong>Created:</strong> ${new Date(ticket.created_at).toLocaleString()}
        `;
        document.getElementById("detail-ticket-desc").textContent = ticket.description;

        if (api.isBankOfficer()) {
            document.getElementById("officer-status-controls").classList.remove("hidden");
            document.getElementById("update-ticket-status").value = ticket.ticket_status;
        }

        const thread = document.getElementById("messages-thread");
        const messages = ticket.messages || [];
        if (!messages.length) {
            thread.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">No messages yet. Start the conversation below.</p>';
        } else {
            thread.innerHTML = messages.map(m => {
                const isOfficer = m.sender_role === "BANK_OFFICER";
                return `
                    <div style="display: flex; flex-direction: column; align-items: ${isOfficer ? 'flex-end' : 'flex-start'}; margin-bottom: 12px;">
                        <div style="max-width: 70%; padding: 10px 14px; border-radius: 12px; background: ${isOfficer ? 'var(--primary)' : 'var(--bg-secondary)'}; color: ${isOfficer ? 'white' : 'var(--text-primary)'}; font-size: 13px;">
                            ${m.message}
                        </div>
                        <small style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                            ${m.sender_name} (${isOfficer ? "Officer" : "Customer"}) · ${new Date(m.created_at).toLocaleString()}
                        </small>
                    </div>
                `;
            }).join("");
            thread.scrollTop = thread.scrollHeight;
        }

        document.getElementById("ticket-detail-section").classList.remove("hidden");
    } catch (err) {
        showToast("Failed to load ticket details.", "error");
    }
}

function closeTicketDetail() {
    currentTicketId = null;
    document.getElementById("ticket-detail-section").classList.add("hidden");
}

async function updateTicketStatus() {
    if (!currentTicketId) return;
    const newStatus = document.getElementById("update-ticket-status").value;
    try {
        await api.patch(`/support/tickets/${currentTicketId}/`, { ticket_status: newStatus });
        showToast("Ticket status updated.", "success");
        loadTickets();
        openTicketDetail(currentTicketId);
    } catch (err) {
        showToast(err.message, "error");
    }
}
