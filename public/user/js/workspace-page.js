
(async function () {
  try {
    const response = await fetch("/api/auth/me", {
      credentials: "same-origin",
    });

    if (!response.ok) {
      window.location.replace("/login.html");
      return;
    }

    const data = await response.json();

    if (!data.success || !data.account) {
      window.location.replace("/login.html");
      return;
    }

    const account = data.account;

    const name = document.getElementById("userName");
    const email = document.getElementById("userEmail");
    const avatar = document.getElementById("avatar");

    if (name) name.textContent = account.name;
    if (email) email.textContent = account.email;
    if (avatar) {
      avatar.textContent = (account.name || "W")
        .trim()
        .charAt(0)
        .toUpperCase();
    }

    const logoutBtn = document.getElementById("logoutBtn");

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        logoutBtn.disabled = true;

        try {
          await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "same-origin",
          });
        } finally {
          window.location.replace("/login.html");
        }
      });
    }

    const menuToggle = document.getElementById("menuToggle");
    const sidebar = document.getElementById("sidebar");

    if (menuToggle && sidebar) {
      menuToggle.addEventListener("click", () => {
        sidebar.classList.toggle("open");
      });
    }
  } catch (error) {
    console.error("Workspace authentication error:", error);
    window.location.replace("/login.html");
  }
})();
