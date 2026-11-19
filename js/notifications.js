/**
 * BankEase - Notifications Page Logic
 * Handles notification listing, mark as read (individual & bulk).
 */

document.addEventListener("DOMContentLoaded", () => {
    loadNotifications();
});

async function loadNotifications() {
    try {
        const res = await api.get("/notifications/");
        const notifications = res.results || res;
        const container = document.getElementById("notifications-list");
        const unreadBadge = document.getElementById("unread-count-badge");

        const unreadCount = notifications.filter(n => !n.is_read).length;
        if (unreadBadge) unreadBadge.textContent = `${unreadCount} unread`;

        if (!container) return;
        if (!notifications.length) {
            container.innerHTML = '<div class="card" style="padding: 40px; text-align: center;"><p style="color: var(--text-muted); font-size: 15px;">🔔 No notifications yet.</p></div>';
            return;
        }

        container.innerHTML = notifications.map(n => `
            <div class="card" style="margin-bottom: 10px; padding: 16px 20px; border-left: 4px solid ${n.is_read ? 'var(--border-color)' : 'var(--primary)'}; opacity: ${n.is_read ? '0.7' : '1'}; cursor: pointer;" onclick="markSingleRead(${n.id}, ${n.is_read})">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <span style="font-size: 16px;">${getNotifIcon(n.notification_type)}</span>
                            <strong style="font-size: 14px;">${n.title}</strong>
                            ${!n.is_read ? '<span class="badge badge-primary" style="font-size: 10px;">NEW</span>' : ''}
                        </div>
                        <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">${n.message}</p>
                    </div>
                    <small style="color: var(--text-muted); white-space: nowrap; font-size: 11px;">${timeAgo(n.created_at)}</small>
                </div>
            </div>
        `).join("");
    } catch (err) {
        showToast("Failed to load notifications.", "error");
    }
}

async function markSingleRead(id, alreadyRead) {
    if (alreadyRead) return;
    try {
        await api.post(`/notifications/${id}/read/`);
        loadNotifications();
    } catch (err) {
        // silent
    }
}

async function markAllRead() {
    try {
        await api.post("/notifications/read/");
        showToast("All notifications marked as read.", "success");
        loadNotifications();
    } catch (err) {
        showToast(err.message, "error");
    }
}

function getNotifIcon(type) {
    const icons = {
        TRANSACTION: "💸",
        LOAN: "🏦",
        INVESTMENT: "📈",
        SECURITY: "🔒",
        SYSTEM: "⚙️",
        ALERT: "⚠️",
    };
    return icons[type] || "🔔";
}

function timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
}
