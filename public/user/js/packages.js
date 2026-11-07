/* ======================================
   WiTime User Packages Script
   Located at: public/user/js/packages.js
====================================== */

document.addEventListener("DOMContentLoaded", async () => {
    const tableBody = document.getElementById("packageTableBody");
    const packageForm = document.getElementById("packageForm");
    const alertBox = document.getElementById("alertBox");
    const submitBtn = document.getElementById("submitBtn");

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

    // 2. Load Operator Packages
    async function loadPackages() {
        try {
            const res = await fetch("/api/packages", { credentials: "include" });
            const packages = await res.json();

            if (!packages || packages.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: #6b7280;">No packages found. Create your first one above!</td></tr>`;
                return;
            }

            tableBody.innerHTML = packages.map(p => `
                <tr>
                    <td><strong>${escapeHtml(p.name)}</strong></td>
                    <td>KES ${p.price}</td>
                    <td>${escapeHtml(p.duration)}</td>
                    <td>
                        <button onclick="deletePackage('${p._id}')" style="background: #fee2e2; color: #991b1b; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12px;">Delete</button>
                    </td>
                </tr>
            `).join("");
        } catch (err) {
            console.error("Error loading packages:", err);
            tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: red;">Failed to load packages from server.</td></tr>`;
        }
    }

    // 3. Handle Form Submission for New Package
    packageForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("packageName").value.trim();
        const price = document.getElementById("packagePrice").value.trim();
        const duration = document.getElementById("packageDuration").value.trim();

        if (!name || !price || !duration) {
            showAlert("Please fill in all fields.", "error");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Saving...";

        try {
            const res = await fetch("/api/packages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, price, duration }),
                credentials: "include"
            });

            const result = await res.json();

            if (res.ok) {
                packageForm.reset();
                showAlert("Package created successfully!", "success");
                loadPackages();
            } else {
                showAlert(result.message || "Failed to create package.", "error");
            }
        } catch (err) {
            console.error("Error creating package:", err);
            showAlert("Server error while saving package.", "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Add Package";
        }
    });

    // Alert helper
    function showAlert(message, type) {
        alertBox.textContent = message;
        alertBox.style.display = "block";
        alertBox.style.background = type === "success" ? "#d1fae5" : "#fee2e2";
        alertBox.style.color = type === "success" ? "#065f46" : "#991b1b";
        alertBox.style.border = type === "success" ? "1px solid #34d399" : "1px solid #f87171";
        setTimeout(() => { alertBox.style.display = "none"; }, 3500);
    }

    // HTML escape helper
    function escapeHtml(str) {
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // Initial load call
    loadPackages();
});

// Global delete function for package rows
async function deletePackage(id) {
    if (!confirm("Are you sure you want to delete this package?")) return;

    try {
        const res = await fetch(`/api/packages/${id}`, {
            method: "DELETE",
            credentials: "include"
        });
        if (res.ok) {
            location.reload();
        } else {
            alert("Failed to delete package.");
        }
    } catch (err) {
        console.error("Delete error:", err);
        alert("Server error during deletion.");
    }
}