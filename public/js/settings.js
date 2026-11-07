// ======================================
// ADMIN ACCOUNT
// ======================================

const adminForm = document.getElementById("adminSettingsForm");

if (adminForm) {

    adminForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        const message = document.getElementById("adminMessage");

        const username =
            document.getElementById("adminUsername").value.trim();

        const currentPassword =
            document.getElementById("currentPassword").value;

        const newPassword =
            document.getElementById("newPassword").value;

        const confirmPassword =
            document.getElementById("confirmPassword").value;

        message.textContent = "";
        message.className = "message";

        if (!username) {
            message.textContent = "Username is required.";
            message.classList.add("error");
            return;
        }

        // If changing password, all password fields are required
        if (newPassword || confirmPassword || currentPassword) {

            if (!currentPassword) {
                message.textContent =
                    "Enter your current password.";
                message.classList.add("error");
                return;
            }

            if (!newPassword) {
                message.textContent =
                    "Enter a new password.";
                message.classList.add("error");
                return;
            }

            if (newPassword !== confirmPassword) {
                message.textContent =
                    "New passwords do not match.";
                message.classList.add("error");
                return;
            }

            if (newPassword.length < 6) {
                message.textContent =
                    "New password must be at least 6 characters.";
                message.classList.add("error");
                return;
            }
        }

        message.textContent =
            "Saving account changes...";

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

                message.textContent =
                    result.message ||
                    "Unable to update account.";

                message.classList.add("error");

                return;
            }

            message.textContent =
                "Account updated successfully.";

            message.classList.add("success");

            // Clear password fields
            document.getElementById("currentPassword").value = "";
            document.getElementById("newPassword").value = "";
            document.getElementById("confirmPassword").value = "";

            /*
             * If the password was changed, force a new login.
             * This is safer than leaving the old session active.
             */
            if (newPassword) {

                setTimeout(() => {

                    window.location.replace(
                        "/admin/login.html"
                    );

                }, 1500);

            }

        } catch (error) {

            console.error(
                "Account update error:",
                error
            );

            message.textContent =
                "Unable to contact the server.";

            message.classList.add("error");
        }

    });

}

// ======================================
// MIKROTIK
// ======================================

const mikrotikForm =
    document.getElementById("mikrotikForm");

const testMikrotik =
    document.getElementById("testMikrotik");


// ======================================
// LOAD SAVED MIKROTIK SETTINGS
// ======================================

async function loadMikrotikSettings() {

    try {

        const response =
            await fetch(
                "/api/admin/mikrotik/settings",
                {
                    credentials: "include",
                    cache: "no-store"
                }
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            !data.success
        ) {

            return;

        }


        if (
            data.configured &&
            data.mikrotik
        ) {

            document.getElementById(
                "mikrotikHost"
            ).value =
                data.mikrotik.host || "";


            document.getElementById(
                "mikrotikUsername"
            ).value =
                data.mikrotik.username || "";


            document.getElementById(
                "mikrotikPort"
            ).value =
                data.mikrotik.port || 8728;


            const status =
                document.getElementById(
                    "mikrotikStatus"
                );


            if (status) {

                status.textContent =
                    "Configured";

                status.className =
                    "status connected";

            }

        }

    } catch (error) {

        console.error(
            "Unable to load MikroTik settings:",
            error
        );

    }

}


// ======================================
// TEST MIKROTIK
// ======================================

if (testMikrotik) {

    testMikrotik.addEventListener(
        "click",
        async function () {

            const message =
                document.getElementById(
                    "mikrotikMessage"
                );


            const host =
                document.getElementById(
                    "mikrotikHost"
                ).value.trim();


            const username =
                document.getElementById(
                    "mikrotikUsername"
                ).value.trim();


            const password =
                document.getElementById(
                    "mikrotikPassword"
                ).value;


            const port =
                document.getElementById(
                    "mikrotikPort"
                ).value.trim();


            if (!host || !username) {

                message.textContent =
                    "Enter the MikroTik host and username.";

                return;

            }


            message.textContent =
                "Testing MikroTik connection...";


            try {

                const response =
                    await fetch(
                        "/api/admin/mikrotik/test",
                        {

                            method: "POST",

                            credentials: "include",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({

                                    host,

                                    username,

                                    password,

                                    port:
                                        Number(port) ||
                                        8728

                                })

                        }
                    );


                const data =
                    await response.json();


                if (
                    !response.ok ||
                    !data.success
                ) {

                    message.textContent =
                        data.message ||
                        "MikroTik connection failed.";

                    return;

                }


                message.textContent =
                    "✅ MikroTik connection successful.";


                const status =
                    document.getElementById(
                        "mikrotikStatus"
                    );


                if (status) {

                    status.textContent =
                        "Connected";

                    status.className =
                        "status connected";

                }

            } catch (error) {

                console.error(
                    "MikroTik test error:",
                    error
                );

                message.textContent =
                    "Unable to connect to MikroTik.";

            }

        }
    );

}


// ======================================
// SAVE MIKROTIK
// ======================================

if (mikrotikForm) {

    mikrotikForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const message =
                document.getElementById(
                    "mikrotikMessage"
                );


            const host =
                document.getElementById(
                    "mikrotikHost"
                ).value.trim();


            const username =
                document.getElementById(
                    "mikrotikUsername"
                ).value.trim();


            const password =
                document.getElementById(
                    "mikrotikPassword"
                ).value;


            const port =
                document.getElementById(
                    "mikrotikPort"
                ).value.trim();


            if (!host || !username) {

                message.textContent =
                    "Enter the MikroTik host and username.";

                return;

            }


            message.textContent =
                "Saving MikroTik settings...";


            try {

                const response =
                    await fetch(
                        "/api/admin/mikrotik/save",
                        {

                            method: "POST",

                            credentials: "include",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({

                                    host,

                                    username,

                                    password,

                                    port:
                                        Number(port) ||
                                        8728

                                })

                        }
                    );


                const data =
                    await response.json();


                if (
                    !response.ok ||
                    !data.success
                ) {

                    message.textContent =
                        data.message ||
                        "Unable to save MikroTik settings.";

                    return;

                }


                message.textContent =
                    "✅ MikroTik settings saved successfully.";


                const status =
                    document.getElementById(
                        "mikrotikStatus"
                    );


                if (status) {

                    status.textContent =
                        "Connected";

                    status.className =
                        "status connected";

                }

            } catch (error) {

                console.error(
                    "MikroTik save error:",
                    error
                );

                message.textContent =
                    "Unable to save MikroTik settings.";

            }

        }
    );

}

window.addEventListener(
    "DOMContentLoaded",
    function () {

        loadAdmin();

        loadMikrotikSettings();

    }
);


// ======================================
// M-PESA PAYMENT SETTINGS
// ======================================

const paymentSettingsForm =
    document.getElementById("paymentSettingsForm");

const paymentMethodSelect =
    document.getElementById("paymentMethod");

const tillNumberGroup =
    document.getElementById("tillNumberGroup");

function updatePaymentMethodFields() {
    if (!paymentMethodSelect || !tillNumberGroup) return;

    const isTill = paymentMethodSelect.value === "till";

    tillNumberGroup.style.display = isTill ? "" : "none";

    document.getElementById("tillNumber").required = isTill;
}

if (paymentMethodSelect) {
    paymentMethodSelect.addEventListener(
        "change",
        updatePaymentMethodFields
    );
}

async function loadPaymentSettings() {
    const status = document.getElementById("mpesaStatus");
    const credentialsStatus = document.getElementById(
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
            throw new Error(data.message || "Unable to load settings.");
        }

        if (!data.configured) {
            status.textContent = "Not Configured";
            status.className = "status disconnected";
            updatePaymentMethodFields();
            return;
        }

        const payment = data.payment;

        document.getElementById("paymentMethod").value =
            payment.paymentMethod;

        document.getElementById("mpesaEnvironment").value =
            payment.environment;

        document.getElementById("businessShortCode").value =
            payment.businessShortCode || "";

        document.getElementById("tillNumber").value =
            payment.paymentMethod === "till"
                ? payment.partyB || ""
                : "";

        document.getElementById("accountReference").value =
            payment.accountReference || "WiTime";

        document.getElementById("callbackURL").value =
            payment.callbackURL || "";

        status.textContent = "Configured";
        status.className = "status connected";

        credentialsStatus.textContent =
            "Consumer Key: " +
            (payment.consumerKeyConfigured ? "Saved" : "Missing") +
            " | Consumer Secret: " +
            (payment.consumerSecretConfigured ? "Saved" : "Missing") +
            " | Passkey: " +
            (payment.passkeyConfigured ? "Saved" : "Missing");

        updatePaymentMethodFields();

    } catch (error) {
        console.error("Payment settings load error:", error);

        status.textContent = "Unable to Load";
        status.className = "status disconnected";
    }
}


// SAVE PAYMENT SETTINGS

if (paymentSettingsForm) {
    paymentSettingsForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const message = document.getElementById(
            "paymentSettingsMessage"
        );

        message.textContent = "Saving payment configuration...";
        message.className = "message";

        const payload = {
            paymentMethod:
                document.getElementById("paymentMethod").value,

            environment:
                document.getElementById("mpesaEnvironment").value,

            businessShortCode:
                document.getElementById("businessShortCode").value.trim(),

            tillNumber:
                document.getElementById("tillNumber").value.trim(),

            accountReference:
                document.getElementById("accountReference").value.trim(),

            callbackURL:
                document.getElementById("callbackURL").value.trim(),

            consumerKey:
                document.getElementById("consumerKey").value.trim(),

            consumerSecret:
                document.getElementById("consumerSecret").value.trim(),

            passkey:
                document.getElementById("mpesaPasskey").value.trim()
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
                    data.message || "Unable to save configuration."
                );
            }

            message.textContent = data.message;
            message.classList.add("success");

            // Clear secret inputs after saving.
            document.getElementById("consumerKey").value = "";
            document.getElementById("consumerSecret").value = "";
            document.getElementById("mpesaPasskey").value = "";

            await loadPaymentSettings();

        } catch (error) {
            console.error("Payment settings save error:", error);

            message.textContent = error.message;
            message.classList.add("error");
        }
    });
}


// LOAD PAYMENT SETTINGS WHEN THE PAGE OPENS

window.addEventListener("DOMContentLoaded", () => {
    updatePaymentMethodFields();
    loadPaymentSettings();
});

// ======================================
// WITime ADMIN LOGOUT
// ======================================

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", async function () {

        const confirmLogout = confirm(
            "Are you sure you want to logout of WiTime?"
        );

        if (!confirmLogout) return;

        logoutBtn.disabled = true;
        logoutBtn.textContent = "Logging out...";

        try {
            const response = await fetch("/api/admin/logout", {
                method: "POST",
                credentials: "include",
                cache: "no-store"
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Logout failed."
                );
            }

            window.location.replace("/admin/login.html");

        } catch (error) {

            console.error("Logout error:", error);

            alert(error.message || "Unable to logout.");

            logoutBtn.disabled = false;
            logoutBtn.textContent = "Logout";
        }
    });
}