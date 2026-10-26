
const DASHBOARD_URL = "/dashboard.html";

const form = document.getElementById("registerForm");
const button = document.getElementById("registerButton");
const message = document.getElementById("message");

function showMessage(text, type = "error") {
  message.textContent = text;
  message.className = `message ${type}`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword =
    document.getElementById("confirmPassword").value;

  if (password !== confirmPassword) {
    showMessage("The passwords do not match.");
    return;
  }

  if (password.length < 10 || password.length > 72) {
    showMessage("Password must be 10–72 characters long.");
    return;
  }

  button.disabled = true;
  button.textContent = "Creating account...";
  message.className = "message";

  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ name, email, password }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Registration failed.");
    }

    showMessage("Account created. Opening your dashboard...", "success");

    const check = await fetch("/api/auth/me", {
      credentials: "same-origin",
    });

    if (!check.ok) {
      throw new Error(
        "Account created, but the login session could not be verified."
      );
    }

    window.location.replace(DASHBOARD_URL);
  } catch (error) {
    showMessage(error.message || "Unable to create your account.");
  } finally {
    button.disabled = false;
    button.textContent = "Create Account";
  }
});
