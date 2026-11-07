/* ======================================
   WiTime User Dashboard Script
   Located at: public/user/js/dashboard.js
====================================== */

document.addEventListener("DOMContentLoaded", async () => {
    const onlineUsersEl = document.getElementById("onlineUsers");
    const totalPackagesEl = document.getElementById("totalPackages");
    const paymentsTodayEl = document.getElementById("paymentsToday");
    const revenueTodayEl = document.getElementById("revenueToday");
    const paymentTableBody = document.getElementById("paymentTable");
    const accountNameEl = document.getElementById("accountName");

    // 1. Verify Session & Set Operator Name
    try {
        const authRes = await fetch("/api/auth/me", { credentials: "include" });
        if (!authRes.ok) {
            window.location.replace("/login.html");
            return;
        }
        const authData = await authRes.json();
        if (authData.success && authData.account) {
            if (accountNameEl) accountNameEl.textContent = authData.account.name;
        }
    } catch (err) {
        console.error("Session check error:", err);
        window.location.replace("/login.html");
        return;
    }

    // 2. Fetch Dashboard Metrics & Payments
    async function loadDashboardData() {
        try {
            const res = await fetch("/api/dashboard/stats", { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch dashboard stats.");

            const data = await res.json();

            // Populate Summary Cards
            if (onlineUsersEl) onlineUsersEl.textContent = data.onlineUsers ?? 0;
            if (totalPackagesEl) totalPackagesEl.textContent = data.totalPackages ?? 0;
            if (paymentsTodayEl) paymentsTodayEl.textContent = data.paymentsToday ?? 0;
            if (revenueTodayEl) revenueTodayEl.textContent = "KES " + Number(data.revenueToday ?? 0).toLocaleString();

            // Populate Recent Payments Table
            const payments = data.recentPayments || [];
            if (payments.length === 0) {
                paymentTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: #6b7280;">No recent transactions found.</td></tr>`;
                return;
            }

            paymentTableBody.innerHTML = payments.map(p => {
                const isSuccess = p.status === "Paid" || p.status === "Completed";
                return `
                    <tr>
                        <td><strong>${escapeHtml(p.phone)}</strong></td>
                        <td>${escapeHtml(p.packageName || "Hotspot Pass")}</td>
                        <td><strong>KES ${Number(p.amount || 0).toLocaleString()}</strong></td>
                        <td>
                            <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; background: ${isSuccess ? '#d1fae5' : '#fee2e2'}; color: ${isSuccess ? '#065f46' : '#991b1b'};">
                                ${isSuccess ? "● " + (p.status || "Paid") : "✕ " + (p.status || "Failed")}
                            </span>
                        </td>
                        <td>${p.createdAt ? new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "N/A"}</td>
                    </tr>
                `;
            }).join("");

        } catch (err) {
            console.error("Error loading dashboard data:", err);
            paymentTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: #dc2626;">Unable to load recent transactions.</td></tr>`;
        }
    }

    // 3. Logout Handler
    document.getElementById("logoutBtn")?.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to log out?")) return;
        try {
            await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
            window.location.replace("/login.html");
        } catch (err) {
            console.error("Logout error:", err);
        }
    });

    // Security helper
    function escapeHtml(str) {
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // Initial Load & Auto-Refresh every 15 seconds
    loadDashboardData();
    setInterval(loadDashboardData, 15000);
});