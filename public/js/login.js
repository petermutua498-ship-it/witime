
const DASHBOARD_URL = "/admin/dashboard.html";

const form = document.getElementById("loginForm");
const button = document.getElementById("loginButton");
const message = document.getElementById("message");

function showMessage(text, type = "error") {
  message.textContent = text;
  message.className = `message ${type}`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  button.disabled = true;
  button.textContent = "Logging in...";
  message.className = "message";

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Login failed.");
    }

    // Confirm the authentication cookie works before redirecting.
    const check = await fetch("/api/auth/me", {
      credentials: "same-origin",
    });

    if (!check.ok) {
      throw new Error(
        "Login response received, but your session could not be verified."
      );
    }

    window.location.replace(DASHBOARD_URL);
  } catch (error) {
    showMessage(error.message || "Unable to log in.");
  } finally {
    button.disabled = false;
    button.textContent = "Log In";
  }
});
