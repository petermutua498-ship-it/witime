/* ======================================
   WiTime User Login Script
   Located at: public/user/js/login.js
====================================== */

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const alertBox = document.getElementById("alertBox");
    const submitBtn = document.getElementById("submitBtn");

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        if (!email || !password) {
            showAlert("Please enter both email and password.");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Signing in...";
        alertBox.style.display = "none";

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
                credentials: "include"
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                showAlert(result.message || "Invalid email or password.");
                submitBtn.disabled = false;
                submitBtn.textContent = "Sign In";
                return;
            }

            // Redirect to user dashboard
            window.location.replace("/dashboard.html");

        } catch (error) {
            console.error("Login error:", error);
            showAlert("Connection error. Please check your network.");
            submitBtn.disabled = false;
            submitBtn.textContent = "Sign In";
        }
    });

    function showAlert(message) {
        alertBox.textContent = message;
        alertBox.style.display = "block";
    }
});