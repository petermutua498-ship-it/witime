
const form = document.getElementById("registerForm");
const notice = document.getElementById("notice");
const registerBtn = document.getElementById("registerBtn");

function showNotice(message, type = "error") {
    notice.textContent = message;
    notice.className = `notice ${type}`;
    notice.hidden = false;
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword =
        document.getElementById("confirmPassword").value;

    if (password !== confirmPassword) {
        showNotice("Your passwords do not match.");
        return;
    }

    registerBtn.disabled = true;
    registerBtn.textContent = "Creating account...";
    notice.hidden = true;

    try {
        const response = await fetch("/api/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            showNotice(data.message || "Registration failed.");
            return;
        }

        showNotice("Account created successfully. Redirecting...", "success");

        window.location.replace("/admin/dashboard.html");
    } catch (error) {
        showNotice("Unable to connect to WiTime. Please try again.");
    } finally {
        registerBtn.disabled = false;
        registerBtn.textContent = "Create Account";
    }
});
