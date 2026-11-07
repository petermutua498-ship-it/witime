/* ======================================
   WiTime User Reports Script
   Located at: public/user/js/reports.js
====================================== */

document.addEventListener("DOMContentLoaded", async () => {
    const totalRevenueEl = document.getElementById("totalRevenue");
    const totalTransactionsEl = document.getElementById("totalTransactions");
    const totalCustomersEl = document.getElementById("totalCustomers");
    const reportTableBody = document.getElementById("reportTableBody");

    // 1. Verify Session & Set Name
    try {
        const authRes = await fetch("/api/auth/me", { credentials: "include" });
        if (!authRes.ok) {
            window.location.replace("/login.html");
            return;
        }
        const authData = await authRes.json();
        if (authData.success && authData.account) {
            const nameEl = document.getElementById("accountName");
            if (nameEl) nameEl.textContent = authData.account.name;
        }
    } catch (err) {
        console.error("Session check error:", err);
        window.location.replace("/login.html");
        return;
    }

    // 2. Load Analytics & Reports Data
    async function loadReports() {
        try {
            const res = await fetch("/api/reports", { credentials: "include" });
            if (!res.ok) throw new Error("Failed to load reports data.");

            const data = await res.json();

            // Populate Summary Metric Cards
            if (totalRevenueEl) {
                totalRevenueEl.textContent = "KES " + Number(data.totalRevenue || 0).toLocaleString();
            }
            if (totalTransactionsEl) {
                totalTransactionsEl.textContent = Number(data.totalTransactions || 0).toLocaleString();
            }
            if (totalCustomersEl) {
                totalCustomersEl.textContent = Number(data.totalCustomers || 0).toLocaleString();
            }

            // Populate Package Sales Table
            const breakdown = data.packageBreakdown || [];
            if (breakdown.length === 0) {
                reportTableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color: #6b7280;">No sales data available yet.</td></tr>`;
                return;
            }

            reportTableBody.innerHTML = breakdown.map(item => `
                <tr>
                    <td><strong>${escapeHtml(item.packageName || "Standard")}</strong></td>
                    <td>${item.count || 0}</td>
                    <td><strong>KES ${Number(item.revenue || 0).toLocaleString()}</strong></td>
                </tr>
            `).join("");

        } catch (err) {
            console.error("Error loading reports:", err);
            reportTableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color: #dc2626;">Unable to retrieve analytics reports.</td></tr>`;
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

    // Initial Load Call
    loadReports();
});