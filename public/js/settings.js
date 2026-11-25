
// ======================================
// WITIME ADMIN SETTINGS
// ======================================

document.addEventListener("DOMContentLoaded", () => {

    // ======================================
    // HELPER FUNCTIONS
    // ======================================

    const getValue = (id) => {
        const element = document.getElementById(id);
        return element ? element.value : "";
    };

    const setValue = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.value = value ?? "";
    };

    const setMessage = (id, message, type = "") => {
        const element = document.getElementById(id);

        if (!element) return;

        element.textContent = message;
        element.className = "message";

        if (type) {
            element.classList.add(type);
        }
    };

    const setStatus = (id, message, connected = true) => {
        const element = document.getElementById(id);

        if (!element) return;

        element.textContent = message;
        element.className = connected
            ? "status connected"
            : "status disconnected";
    };


    // ======================================
    // ADMIN ACCOUNT
    // ======================================

    const adminForm =
        document.getElementById("adminSettingsForm");

    if (adminForm) {

        adminForm.addEventListener("submit", async (event) => {

            event.preventDefault();

            const username = getValue("adminUsername").trim();
            const currentPassword = getValue("currentPassword");
            const newPassword = getValue("newPassword");
            const confirmPassword = getValue("confirmPassword");

            setMessage("adminMessage", "");

            if (!username) {
                setMessage(
                    "adminMessage",
                    "Username is required.",
                    "error"
                );
                return;
            }

            if (newPassword || confirmPassword || currentPassword) {

                if (!currentPassword) {
                    setMessage(
                        "adminMessage",
                        "Enter your current password.",
                        "error"
                    );
                    return;
                }

                if (!newPassword) {
                    setMessage(
                        "adminMessage",
                        "Enter a new password.",
                        "error"
                    );
                    return;
                }

                if (newPassword !== confirmPassword) {
                    setMessage(
                        "adminMessage",
                        "New passwords do not match.",
                        "error"
                    );
                    return;
                }

                if (newPassword.length < 6) {
                    setMessage(
                        "adminMessage",
                        "New password must be at least 6 characters.",
                        "error"
                    );
                    return;
                }
            }

            setMessage(
                "adminMessage",
                "Saving account changes..."
            );

            try {

                const response = await fetch(
                    "/api/admin/update-account",
                    {
                        method: "PUT",
                        credentials: "include",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            username,
                            currentPassword,
                            newPassword
                        })
                    }
                );

                const result = await response.json();

                if (!response.ok || !result.success) {
                    setMessage(
                        "adminMessage",
                        result.message || "Unable to update account.",
                        "error"
                    );
                    return;
                }

                setMessage(
                    "adminMessage",
                    "Account updated successfully.",
                    "success"
                );

                setValue("currentPassword", "");
                setValue("newPassword", "");
                setValue("confirmPassword", "");

                // Require a fresh login after password change.
                if (newPassword) {
                    setTimeout(() => {
                        window.location.replace(
                            "/admin/login.html"
                        );
                    }, 1500);
                }

            } catch (error) {

                console.error("Account update error:", error);

                setMessage(
                    "adminMessage",
                    "Unable to contact the server.",
                    "error"
                );
            }
        });
    }


    // ======================================
    // MIKROTIK SETTINGS
    // ======================================

    const mikrotikForm =
        document.getElementById("mikrotikForm");

    // ======================================
    // LOAD SAVED MIKROTIK SETTINGS
    // ======================================

    async function loadMikrotikSettings() {

        try {

            const response = await fetch(
                "/api/admin/mikrotik/settings",
                {
                    credentials: "include",
                    cache: "no-store"
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Unable to load MikroTik settings."
                );
            }

            if (!data.configured || !data.mikrotik) {
                setStatus(
                    "mikrotikStatus",
                    "Not Configured",
                    false
                );
                return;
            }

            const mikrotik = data.mikrotik;

            setValue("mikrotikHost", mikrotik.host);
            setValue("mikrotikUsername", mikrotik.username);
            setValue("mikrotikPort", mikrotik.port || 8728);

            // Hotspot settings
            setValue(
                "hotspotSSID",
                mikrotik.hotspotSSID || "WiTime hotspot"
            );

            setValue(
                "routerMaxUsers",
                mikrotik.maxUsers ?? 10
            );

            setValue(
                "routerFreeMinutes",
                mikrotik.freeMinutes ?? 0
            );

            setValue(
                "hotspotEnabled",
                String(mikrotik.hotspotEnabled ?? true)
            );

            setStatus(
                "mikrotikStatus",
                "Configured",
                true
            );

        } catch (error) {

            console.error(
                "Unable to load MikroTik settings:",
                error
            );

            setStatus(
                "mikrotikStatus",
                "Unable to Load",
                false
            );
        }
    }


    // ======================================
    // SAVE MIKROTIK AND HOTSPOT SETTINGS
    // ======================================

    if (mikrotikForm) {

        mikrotikForm.addEventListener("submit", async (event) => {

            event.preventDefault();

            const host = getValue("mikrotikHost").trim();
            const username = getValue("mikrotikUsername").trim();
            const password = getValue("mikrotikPassword");
            const port = Number(getValue("mikrotikPort")) || 8728;

            const hotspotSSID =
                getValue("hotspotSSID").trim();

            const hotspotEnabled =
                getValue("hotspotEnabled") === "true";

            const maxUsers =
                Number(getValue("routerMaxUsers"));

            const freeMinutes =
                Number(getValue("routerFreeMinutes"));

            if (!host || !username) {
                setMessage(
                    "mikrotikMessage",
                    "Enter the MikroTik host and username.",
                    "error"
                );
                return;
            }

            if (!hotspotSSID) {
                setMessage(
                    "mikrotikMessage",
                    "Enter a hotspot Wi-Fi name.",
                    "error"
                );
                return;
            }

            if (hotspotSSID.length > 32) {
    setMessage(
        "mikrotikMessage",
        "Hotspot name cannot exceed 32 characters.",
        "error"
    );
    return;
}

            if (
    !Number.isInteger(maxUsers) ||
    maxUsers < 1 ||
    maxUsers > 100
) {
                setMessage(
                    "mikrotikMessage",
                    "Maximum users must be between 1 and 100.",
                    "error"
                );
                return;
            }

            if (
    !Number.isInteger(freeMinutes) ||
    freeMinutes < 0 ||
    freeMinutes > 1440
) {
    setMessage(
        "mikrotikMessage",
        "Free minutes must be between 0 and 1440.",
        "error"
    );
    return;
}
                

            if (
                !Number.isInteger(port) ||
                port < 1 ||
                port > 65535
            ) {
                setMessage(
                    "mikrotikMessage",
                    "Enter a valid MikroTik API port.",
                    "error"
                );
                return;
            }

            setMessage(
                "mikrotikMessage",
                "Saving MikroTik and hotspot settings..."
            );

            const saveButton =
                mikrotikForm.querySelector(
                    'button[type="submit"]'
                );

            if (saveButton) {
                saveButton.disabled = true;
            }

            try {

                const response = await fetch(
                    "/api/admin/mikrotik/save",
                    {
                        method: "POST",
                        credentials: "include",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            host,
                            username,
                            password,
                            port,
                            hotspotSSID,
                            hotspotEnabled,
                            maxUsers,
                            freeMinutes
                        })
                    }
                );

                const data = await response.json();

                if (!response.ok || !data.success) {
                    setMessage(
                        "mikrotikMessage",
                        data.message || "Unable to save MikroTik settings.",
                        "error"
                    );
                    return;
                }

                // Clear password field after successful save.
                setValue("mikrotikPassword", "");

                setMessage(
                    "mikrotikMessage",
                    "MikroTik and hotspot settings saved successfully.",
                    "success"
                );

                setStatus(
                    "mikrotikStatus",
                    "Configured",
                    true
                );

            } catch (error) {

                console.error("MikroTik save error:", error);

                setMessage(
                    "mikrotikMessage",
                    "Unable to save MikroTik settings.",
                    "error"
                );

            } finally {

                if (saveButton) {
                    saveButton.disabled = false;
                }
            }
        });
    }

// ======================================
// DOWNLOAD MIKROTIK CONFIGURATION
// ======================================

const downloadMikrotikConfig =
    document.getElementById("downloadMikrotikConfig");

if (downloadMikrotikConfig) {

    downloadMikrotikConfig.addEventListener("click", async () => {

        const originalText = downloadMikrotikConfig.textContent;

        downloadMikrotikConfig.disabled = true;
        downloadMikrotikConfig.textContent = "Preparing Download...";

        setMessage(
            "mikrotikMessage",
            "Generating your MikroTik configuration..."
        );

        try {

            const response = await fetch(
                "/api/admin/mikrotik/download-rsc",
                {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store"
                }
            );

            if (!response.ok) {

                let message = "Unable to download router configuration.";

                try {
                    const data = await response.json();
                    message = data.message || message;
                } catch (_) {}

                throw new Error(message);
            }

            const blob = await response.blob();

            if (!blob.size) {
                throw new Error("The generated configuration file is empty.");
            }

            const downloadUrl = URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = downloadUrl;
            link.download = "witime-hotspot.rsc";

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
}, 1000);

            setMessage(
                "mikrotikMessage",
                "Router configuration downloaded successfully.",
                "success"
            );

        } catch (error) {

            console.error(
                "MikroTik configuration download error:",
                error
            );

            setMessage(
                "mikrotikMessage",
                error.message || "Configuration download failed.",
                "error"
            );

        } finally {

            downloadMikrotikConfig.disabled = false;
            downloadMikrotikConfig.textContent = originalText;

        }
    });
}


    // ======================================
    // M-PESA PAYMENT SETTINGS
    // ======================================

    const paymentSettingsForm =
        document.getElementById("paymentSettingsForm");

    const paymentMethodSelect =
        document.getElementById("paymentMethod");

    const tillNumberGroup =
        document.getElementById("tillNumberGroup");


    // ======================================
    // SHOW/HIDE TILL NUMBER
    // ======================================

    function updatePaymentMethodFields() {

        if (!paymentMethodSelect || !tillNumberGroup) {
            return;
        }

        const isTill =
            paymentMethodSelect.value === "till";

        tillNumberGroup.style.display =
            isTill ? "" : "none";

        const tillNumber =
            document.getElementById("tillNumber");

        if (tillNumber) {
            tillNumber.required = isTill;
        }
    }

    if (paymentMethodSelect) {
        paymentMethodSelect.addEventListener(
            "change",
            updatePaymentMethodFields
        );
    }


    // ======================================
    // LOAD M-PESA SETTINGS
    // ======================================

    async function loadPaymentSettings() {

        const status =
            document.getElementById("mpesaStatus");

        const credentialsStatus =
            document.getElementById(
                "paymentCredentialsStatus"
            );

        try {

            const response = await fetch(
                "/api/admin/payment-settings",
                {
                    credentials: "include",
                    cache: "no-store"
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Unable to load payment settings."
                );
            }

            if (!data.configured) {

                if (status) {
                    status.textContent = "Not Configured";
                    status.className = "status disconnected";
                }

                updatePaymentMethodFields();
                return;
            }

            const payment = data.payment;

            setValue(
                "paymentMethod",
                payment.paymentMethod
            );

            setValue(
                "mpesaEnvironment",
                payment.environment
            );

            setValue(
                "businessShortCode",
                payment.businessShortCode || ""
            );

            setValue(
                "tillNumber",
                payment.paymentMethod === "till"
                    ? payment.partyB || ""
                    : ""
            );

            setValue(
                "accountReference",
                payment.accountReference || "WiTime"
            );

            setValue(
                "callbackURL",
                payment.callbackURL || ""
            );

            if (status) {
                status.textContent = "Configured";
                status.className = "status connected";
            }

            if (credentialsStatus) {

                credentialsStatus.textContent =
                    "Consumer Key: " +
                    (payment.consumerKeyConfigured ? "Saved" : "Missing") +
                    " | Consumer Secret: " +
                    (payment.consumerSecretConfigured ? "Saved" : "Missing") +
                    " | Passkey: " +
                    (payment.passkeyConfigured ? "Saved" : "Missing");
            }

            updatePaymentMethodFields();

        } catch (error) {

            console.error(
                "Payment settings load error:",
                error
            );

            if (status) {
                status.textContent = "Unable to Load";
                status.className = "status disconnected";
            }
        }
    }


    // ======================================
    // SAVE M-PESA SETTINGS
    // ======================================

    if (paymentSettingsForm) {

        paymentSettingsForm.addEventListener(
            "submit",
            async (event) => {

                event.preventDefault();

                setMessage(
                    "paymentSettingsMessage",
                    "Saving payment configuration..."
                );

                const payload = {

                    paymentMethod:
                        getValue("paymentMethod"),

                    environment:
                        getValue("mpesaEnvironment"),

                    businessShortCode:
                        getValue("businessShortCode").trim(),

                    tillNumber:
                        getValue("tillNumber").trim(),

                    accountReference:
                        getValue("accountReference").trim(),

                    callbackURL:
                        getValue("callbackURL").trim(),

                    consumerKey:
                        getValue("consumerKey").trim(),

                    consumerSecret:
                        getValue("consumerSecret").trim(),

                    passkey:
                        getValue("mpesaPasskey").trim()
                };

                try {

                    const response = await fetch(
                        "/api/admin/payment-settings",
                        {
                            method: "PUT",
                            credentials: "include",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify(payload)
                        }
                    );

                    const data = await response.json();

                    if (!response.ok || !data.success) {
                        throw new Error(
                            data.message ||
                            "Unable to save payment configuration."
                        );
                    }

                    setMessage(
                        "paymentSettingsMessage",
                        data.message || "Payment settings saved successfully.",
                        "success"
                    );

                    // Clear secret inputs after saving.
                    setValue("consumerKey", "");
                    setValue("consumerSecret", "");
                    setValue("mpesaPasskey", "");

                    await loadPaymentSettings();

                } catch (error) {

                    console.error(
                        "Payment settings save error:",
                        error
                    );

                    setMessage(
                        "paymentSettingsMessage",
                        error.message || "Unable to save payment settings.",
                        "error"
                    );
                }
            }
        );
    }


    // ======================================
    // ADMIN LOGOUT
    // ======================================

    const logoutBtn =
        document.getElementById("logoutBtn");

    if (logoutBtn) {

        logoutBtn.addEventListener("click", async () => {

            const confirmLogout = confirm(
                "Are you sure you want to logout of WiTime?"
            );

            if (!confirmLogout) return;

            logoutBtn.disabled = true;
            logoutBtn.textContent = "Logging out...";

            try {

                const response = await fetch(
                    "/api/admin/logout",
                    {
                        method: "POST",
                        credentials: "include",
                        cache: "no-store"
                    }
                );

                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(
                        result.message || "Logout failed."
                    );
                }

                window.location.replace(
                    "/admin/login.html"
                );

            } catch (error) {

                console.error("Logout error:", error);

                alert(
                    error.message || "Unable to logout."
                );

                logoutBtn.disabled = false;
                logoutBtn.textContent = "Logout";
            }
        });
    }


    // ======================================
    // LOAD SETTINGS WHEN PAGE OPENS
    // ======================================

    // Load admin details if the existing function is available.
    if (typeof window.loadAdmin === "function") {
        window.loadAdmin();
    }

    loadMikrotikSettings();
    loadPaymentSettings();
    updatePaymentMethodFields();

});
