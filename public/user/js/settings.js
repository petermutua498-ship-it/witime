/* ======================================
   WiTime User Settings Script
   Located at: public/user/js/settings.js
====================================== */

document.addEventListener("DOMContentLoaded", async () => {
    const profileForm = document.getElementById("profileForm");
    const passwordForm = document.getElementById("passwordForm");
    const alertBox = document.getElementById("alertBox");

    const settingName = document.getElementById("settingName");
    const settingEmail = document.getElementById("settingEmail");
    const settingPhone = document.getElementById("settingPhone");

    const saveProfileBtn = document.getElementById("saveProfileBtn");
    const changePasswordBtn = document.getElementById("changePasswordBtn");

    // 1. Verify Session & Load Current Profile
    try {
        const authRes = await fetch("/api/auth/me", { credentials: "include" });
        if (!authRes.ok) {
            window.location.replace("/login.html");
            return;
        }

        const authData = await authRes.json();
        if (authData.success && authData.account) {
            const acc = authData.account;
            document.getElementById("accountName").textContent = acc.name || "User";

            if (settingName) settingName.value = acc.name || "";
            if (settingEmail) settingEmail.value = acc.email || "";
            if (settingPhone) settingPhone.value = acc.phone || "";
        }
    } catch (err) {
        console.error("Session check error:", err);
        window.location.replace("/login.html");
        return;
    }

    // 2. Handle Profile Updates
    profileForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = settingName.value.trim();
        const email = settingEmail.value.trim();
        const phone = settingPhone.value.trim();

        if (!name || !email || !phone) {
            showAlert("Please fill in all profile fields.", "error");
            return;
        }

        saveProfileBtn.disabled = true;
        saveProfileBtn.textContent = "Updating...";

        try {
            const res = await fetch("/api/user/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, phone }),
                credentials: "include"
            });

            const result = await res.json();

            if (res.ok && result.success) {
                showAlert("Profile updated successfully!", "success");
                document.getElementById("accountName").textContent = name;
            } else {
                showAlert(result.message || "Failed to update profile.", "error");
            }
        } catch (err) {
            console.error("Profile update error:", err);
            showAlert("Server error while updating profile.", "error");
        } finally {
            saveProfileBtn.disabled = false;
            saveProfileBtn.textContent = "Update Profile";
        }
    });

    // 3. Handle Password Updates
    passwordForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const currentPassword = document.getElementById("currentPassword").value;
        const newPassword = document.getElementById("newPassword").value;

        if (!currentPassword || !newPassword) {
            showAlert("Please provide both current and new passwords.", "error");
            return;
        }

        changePasswordBtn.disabled = true;
        changePasswordBtn.textContent = "Changing...";

        try {
            const res = await fetch("/api/user/password", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword }),
                credentials: "include"
            });

            const result = await res.json();

            if (res.ok && result.success) {
                passwordForm.reset();
                showAlert("Password updated successfully!", "success");
            } else {
                showAlert(result.message || "Failed to change password.", "error");
            }
        } catch (err) {
            console.error("Password change error:", err);
            showAlert("Server error while updating password.", "error");
        } finally {
            changePasswordBtn.disabled = false;
            changePasswordBtn.textContent = "Change Password";
        }
    });

    // 4. Logout Handler
    document.getElementById("logoutBtn")?.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to log out?")) return;
        try {
            await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
            window.location.replace("/login.html");
        } catch (err) {
            console.error("Logout error:", err);
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

    /* ======================================
   WiTime User Settings Script
   Located at: public/user/js/settings.js
====================================== */

document.addEventListener("DOMContentLoaded", async () => {
    const profileForm = document.getElementById("profileForm");
    const mpesaForm = document.getElementById("mpesaForm");
    const passwordForm = document.getElementById("passwordForm");
    const alertBox = document.getElementById("alertBox");

    const mpesaType = document.getElementById("mpesaType");
    const mpesaNumber = document.getElementById("mpesaNumber");
    const mpesaAccount = document.getElementById("mpesaAccount");
    const accountNumberWrapper = document.getElementById("accountNumberWrapper");
    const numLabel = document.getElementById("numLabel");
    const saveMpesaBtn = document.getElementById("saveMpesaBtn");

    // 1. Toggle Paybill Account field dynamically
    mpesaType?.addEventListener("change", () => {
        if (mpesaType.value === "Paybill") {
            numLabel.textContent = "Paybill Number";
            accountNumberWrapper.style.display = "block";
        } else {
            numLabel.textContent = "Till / Store Number";
            accountNumberWrapper.style.display = "none";
        }
    });

    // 2. Load Operator's Saved Till/Paybill Info
    try {
        const authRes = await fetch("/api/auth/me", { credentials: "include" });
        if (!authRes.ok) return window.location.replace("/login.html");

        const authData = await authRes.json();
        if (authData.success && authData.account) {
            const acc = authData.account;
            document.getElementById("accountName").textContent = acc.name || "Operator";

            document.getElementById("settingName").value = acc.name || "";
            document.getElementById("settingEmail").value = acc.email || "";
            document.getElementById("settingPhone").value = acc.phone || "";

            if (acc.mpesa) {
                mpesaType.value = acc.mpesa.type || "BuyGoods";
                mpesaNumber.value = acc.mpesa.number || "";
                mpesaAccount.value = acc.mpesa.account || "";
                mpesaType.dispatchEvent(new Event("change"));
            }
        }
    } catch (err) {
        console.error("Session check error:", err);
        window.location.replace("/login.html");
        return;
    }

    // 3. Save Till/Paybill Configuration
    mpesaForm?.addEventListener("submit", async (e) => {
        e.preventDefault();

        const type = mpesaType.value;
        const number = mpesaNumber.value.trim();
        const account = mpesaAccount.value.trim();

        if (!number) {
            showAlert("Please enter your Till or Paybill number.", "error");
            return;
        }

        saveMpesaBtn.disabled = true;
        saveMpesaBtn.textContent = "Saving...";

        try {
            const res = await fetch("/api/user/mpesa", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, number, account }),
                credentials: "include"
            });

            const result = await res.json();
            if (res.ok && result.success) {
                showAlert("M-Pesa details updated successfully!", "success");
            } else {
                showAlert(result.message || "Failed to update M-Pesa details.", "error");
            }
        } catch (err) {
            showAlert("Server error while updating M-Pesa setup.", "error");
        } finally {
            saveMpesaBtn.disabled = false;
            saveMpesaBtn.textContent = "Save M-Pesa Setup";
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
});
});