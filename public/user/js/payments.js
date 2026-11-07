

document.addEventListener("DOMContentLoaded", async () => {
    const tableBody = document.getElementById("paymentTableBody");
    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");
    const refreshBtn = document.getElementById("refreshBtn");
    let allPayments = [];

    // 1. Verify User Session & Set Name
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

    // 2. Load Payment Logs
    async function loadPayments() {
        try {
            const res = await fetch("/api/payments", { credentials: "include" });
            if (!res.ok) throw new Error("Failed to load payments list.");

            allPayments = await res.json();
            filterAndRender();
        } catch (err) {
            console.error("Error loading payments:", err);
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: #dc2626;">Unable to retrieve payment logs.</td></tr>`;
        }
    }

    // 3. Filter & Render Function
    function filterAndRender() {
        const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
        const selectedStatus = statusFilter ? statusFilter.value : "ALL";

        const filtered = allPayments.filter(p => {
            const matchesQuery = 
                (p.mpesaCode && p.mpesaCode.toLowerCase().includes(query)) ||
                (p.phone && p.phone.toLowerCase().includes(query)) ||
                (p.packageName && p.packageName.toLowerCase().includes(query));

            const isPaidStatus = p.status === "Paid" || p.status === "Completed";
            const matchesStatus = 
                selectedStatus === "ALL" ||
                (selectedStatus === "Paid" && isPaidStatus) ||
                (selectedStatus === "Failed" && !isPaidStatus);

            return matchesQuery && matchesStatus;
        });

        renderTable(filtered);
    }

    // 4. Render Table Rows
    function renderTable(payments) {
        if (!payments || payments.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: #6b7280;">No payment transactions found.</td></tr>`;
            return;
        }

        tableBody.innerHTML = payments.map(p => {
            const isSuccess = p.status === "Paid" || p.status === "Completed";
            return `
                <tr>
                    <td><code>${escapeHtml(p.mpesaCode || "N/A")}</code></td>
                    <td><strong>${escapeHtml(p.phone)}</strong></td>
                    <td>${escapeHtml(p.packageName || "Standard Pass")}</td>
                    <td><strong>KES ${Number(p.amount || 0).toLocaleString()}</strong></td>
                    <td>
                        <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; background: ${isSuccess ? '#d1fae5' : '#fee2e2'}; color: ${isSuccess ? '#065f46' : '#991b1b'};">
                            ${isSuccess ? "● " + (p.status || "Paid") : "✕ " + (p.status || "Failed")}
                        </span>
                    </td>
                    <td>${p.createdAt ? new Date(p.createdAt).toLocaleString() : "N/A"}</td>
                </tr>
            `;
        }).join("");
    }

    // 5. Event Listeners for Filters
    if (searchInput) searchInput.addEventListener("input", filterAndRender);
    if (statusFilter) statusFilter.addEventListener("change", filterAndRender);

    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Refreshing transactions...</td></tr>`;
            loadPayments();
        });
    }

    // Security helper
    function escapeHtml(str) {
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // Initial Load
    loadPayments();
});