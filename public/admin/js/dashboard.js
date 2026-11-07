
/* ======================================
   WiTime ADMIN Dashboard
====================================== */

// ======================================
// CHECK ADMIN SESSION
// ======================================

async function checkAdminSession() {
    try {
        const response = await fetch("/api/admin/me", {
            method: "GET",
            credentials: "include",
            cache: "no-store"
        });

        if (!response.ok) {
            window.location.replace("/admin/login.html");
            return false;
        }

        const data = await response.json();

        // Backend returns admin, NOT account
        if (!data.success || !data.admin?.loggedIn) {
            window.location.replace("/admin/login.html");
            return false;
        }

        const accountName = document.getElementById("accountName");

        if (accountName) {
            accountName.textContent = data.admin.username;
        }

        return true;

    } catch (error) {
        console.error("Admin session check failed:", error);
        window.location.replace("/admin/login.html");
        return false;
    }
}

// ======================================
// DASHBOARD ELEMENTS
// ======================================

const onlineUsers = document.getElementById("onlineUsers");
const totalPackages = document.getElementById("totalPackages");
const paymentsToday = document.getElementById("paymentsToday");
const revenueToday = document.getElementById("revenueToday");

// ======================================
// LOAD DASHBOARD STATISTICS
// ======================================

async function loadDashboard() {
    try {
        const response = await fetch("/api/dashboard/stats", {
            credentials: "include",
            cache: "no-store"
        });

        if (response.status === 401) {
            window.location.replace("/admin/login.html");
            return;
        }

        if (!response.ok) {
            throw new Error(
                "Unable to load dashboard statistics. Status: " +
                response.status
            );
        }

        const data = await response.json();

        if (onlineUsers) {
            onlineUsers.textContent = data.onlineUsers ?? 0;
        }

        if (totalPackages) {
            totalPackages.textContent = data.totalPackages ?? 0;
        }

        if (paymentsToday) {
            paymentsToday.textContent = data.paymentsToday ?? 0;
        }

        if (revenueToday) {
            revenueToday.textContent =
                "KES " +
                Number(data.revenueToday ?? 0).toLocaleString();
        }

    } catch (error) {
        console.error("Dashboard statistics error:", error);
    }
}

// ======================================
// ADMIN LOGOUT
// ======================================

document.addEventListener("click", async function (event) {
    const logoutBtn = event.target.closest("#logoutBtn");

    if (!logoutBtn) return;

    if (!confirm("Are you sure you want to logout?")) {
        return;
    }

    try {
        logoutBtn.disabled = true;

        const response = await fetch("/api/admin/logout", {
            method: "POST",
            credentials: "include",
            cache: "no-store"
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Logout failed.");
        }

        window.location.replace("/admin/login.html");

    } catch (error) {
        console.error("Admin logout error:", error);
        alert(error.message || "Unable to logout.");

        logoutBtn.disabled = false;
    }
});

// ======================================
// START DASHBOARD
// ======================================

async function startDashboard() {
    const authenticated = await checkAdminSession();

    if (!authenticated) return;

    await loadDashboard();

    // Refresh every 10 seconds
    setInterval(loadDashboard, 10000);
}

startDashboard();
