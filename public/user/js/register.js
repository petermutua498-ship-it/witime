/* ======================================
   WiTime User Registration Script
   Located at: public/user/js/register.js
====================================== */

document.addEventListener("DOMContentLoaded", () => {
    const registerForm = document.getElementById("registerForm");
    const alertBox = document.getElementById("alertBox");
    const submitBtn = document.getElementById("submitBtn");

    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("fullName").value.trim();
        const email = document.getElementById("email").value.trim();
        const phone = document.getElementById("phone").value.trim();
        const password = document.getElementById("password").value;

        if (!name || !email || !phone || !password) {
            showAlert("Please fill in all fields.", "error");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Creating Account...";

        try {
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, phone, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showAlert("Account created successfully! Redirecting to login...", "success");
                setTimeout(() => {
                    window.location.href = "/login.html";
                }, 1500);
            } else {
                showAlert(data.message || "Registration failed. Try again.", "error");
                submitBtn.disabled = false;
                submitBtn.textContent = "Register Workspace";
            }
        } catch (error) {
            console.error("Registration error:", error);
            showAlert("Server error. Please check your connection.", "error");
            submitBtn.disabled = false;
            submitBtn.textContent = "Register Workspace";
        }
    });

    function showAlert(message, type) {
        alertBox.textContent = message;
        alertBox.className = `alert-message ${type === "error" ? "alert-error" : "alert-success"}`;
        alertBox.style.display = "block";
    }
});