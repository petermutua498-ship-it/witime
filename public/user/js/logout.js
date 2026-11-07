/* ======================================
   WiTime User Logout Handler
   Located at: public/user/js/logout.js
====================================== */

async function handleLogout() {
    if (!confirm("Are you sure you want to log out of WiTime Workspace?")) {
        return;
    }

    try {
        const response = await fetch("/api/auth/logout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            cache: "no-store"
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // Clear local or session storage if used
            localStorage.clear();
            sessionStorage.clear();

            // Redirect safely to login page
            window.location.replace("/login.html");
        } else {
            alert(result.message || "Logout failed. Please try again.");
        }
    } catch (error) {
        console.error("Logout network error:", error);
        // Fallback redirection in case network fails
        window.location.replace("/login.html");
    }
}

// Global click listener for sidebar logout button
document.addEventListener("click", (event) => {
    const logoutBtn = event.target.closest("#logoutBtn");
    if (logoutBtn) {
        event.preventDefault();
        handleLogout();
    }
});