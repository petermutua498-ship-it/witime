/* ======================================
   WiTime User Customers Script
   Located at: public/user/js/customers.js
====================================== */

document.addEventListener("DOMContentLoaded", async () => {
    const tableBody = document.getElementById("customerTableBody");
    const searchInput = document.getElementById("searchInput");
    const refreshBtn = document.getElementById("refreshBtn");
    let allCustomers = [];

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

    // 2. Fetch Customer Data
    async function loadCustomers() {
        try {
            const res = await fetch("/api/customers", { credentials: "include" });
            if (!res.ok) throw new Error("Failed to load customer list.");

            allCustomers = await res.json();
            renderTable(allCustomers);
        } catch (err) {
            console.error("Error loading customers:", err);
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: #dc2626;">Unable to retrieve customer data.</td></tr>`;
        }
    }

    // 3. Render Table
    function renderTable(customers) {
        if (!customers || customers.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: #6b7280;">No customer records found.</td></tr>`;
            return;
        }

        tableBody.innerHTML = customers.map(c => {
            const isOnline = c.status === "Active" || c.status === "Online";
            return `
                <tr>
                    <td><strong>${escapeHtml(c.phone)}</strong></td>
                    <td>${escapeHtml(c.currentPackage || "None")}</td>
                    <td>KES ${Number(c.totalSpent || 0).toLocaleString()}</td>
                    <td>${c.lastSeen ? new Date(c.lastSeen).toLocaleString() : "N/A"}</td>
                    <td>
                        <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; background: ${isOnline ? '#d1fae5' : '#f3f4f6'}; color: ${isOnline ? '#065f46' : '#6b7280'};">
                            ${isOnline ? "● Active" : "Offline"}
                        </span>
                    </td>
                </tr>
            `;
        }).join("");
    }

    // 4. Search Filter
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const query = e.target.value.toLowerCase().trim();
            const filtered = allCustomers.filter(c => 
                (c.phone && c.phone.toLowerCase().includes(query)) ||
                (c.currentPackage && c.currentPackage.toLowerCase().includes(query))
            );
            renderTable(filtered);
        });
    }

    // 5. Refresh Action
    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Refreshing...</td></tr>`;
            loadCustomers();
        });
    }

    // Security helper
    function escapeHtml(str) {
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // Initial load
    loadCustomers();
});