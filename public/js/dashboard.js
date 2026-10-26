
const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const welcomeName = document.getElementById("welcomeName");
const avatar = document.getElementById("avatar");
const pageMessage = document.getElementById("pageMessage");

async function loadDashboard() {
  try {
    const response = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    if (response.status === 401 || response.status === 403) {
      window.location.replace("/login.html");
      return;
    }

    if (!response.ok) {
      throw new Error("Unable to verify your account.");
    }

    const data = await response.json();
    const account = data.account;

    if (!data.success || !account) {
      throw new Error("Account information was not returned.");
    }

    const name = account.name || "WiTime User";

    userName.textContent = name;
    userEmail.textContent = account.email || "";
    welcomeName.textContent = name;
    avatar.textContent = name.trim().charAt(0).toUpperCase() || "W";

  } catch (error) {
    console.error("Dashboard loading error:", error);
    pageMessage.textContent =
      "Could not load your account. Check your connection and refresh the page.";
  }
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  const button = document.getElementById("logoutBtn");
  button.disabled = true;

  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });

    if (!response.ok) {
      throw new Error("Logout failed.");
    }

    window.location.replace("/login.html");
  } catch (error) {
    console.error("Logout error:", error);
    pageMessage.textContent = "Unable to log out. Please try again.";
    button.disabled = false;
  }
});

document.getElementById("menuToggle").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

loadDashboard();
