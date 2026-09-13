document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const phone = params.get("phone");
    const routerIp = params.get("routerIp") || "192.168.88.1";

    if (!phone) {
        alert("Invalid session. Phone number missing.");
        window.location.href = "/";
        return;
    }

    // Set UI basic elements
    const phoneElement = document.getElementById("phone");
    if (phoneElement) phoneElement.innerText = phone;

    const packageElement = document.getElementById("package");
    if (packageElement) {
        packageElement.innerText = localStorage.getItem("packageName") || "Wi-Fi Package";
    }

    let countdownInterval = null;
    let statusPollInterval = null;
    let hasLoggedIntoMikrotik = false;

    // 1. Poll database until M-Pesa payment is confirmed
    function startStatusPolling() {
        fetchConnectionStatus();
        statusPollInterval = setInterval(fetchConnectionStatus, 2000);
    }

    async function fetchConnectionStatus() {
        try {
            const response = await fetch(`/api/connected/${encodeURIComponent(phone)}`, {
                cache: "no-store"
            });

            if (!response.ok) return;

            const data = await response.json();

            // Render timestamps
            const connectedAt = document.getElementById("connectedAt");
            if (connectedAt && data.loginTime) {
                connectedAt.innerText = new Date(data.loginTime).toLocaleString();
            }

            const expiresAt = document.getElementById("expiresAt");
            if (expiresAt && data.expiryTime) {
                expiresAt.innerText = new Date(data.expiryTime).toLocaleString();
            }

            // Once payment/user is ready, authenticate with MikroTik
            if (["Paid", "Online", "Active", "Offline", "success"].includes(data.status)) {
                // Stop database polling
                if (statusPollInterval) clearInterval(statusPollInterval);

                if (!hasLoggedIntoMikrotik) {
                    hasLoggedIntoMikrotik = true;
                    // FIX: Trigger login form submission directly
                    submitMikrotikCredentials(data.expiryTime);
                }

            } else if (data.status === "Expired") {
                if (statusPollInterval) clearInterval(statusPollInterval);
                renderExpiredState();
            }

        } catch (error) {
            console.error("Status polling error:", error);
        }
    }

    // 2. Submit credentials to MikroTik Hotspot
    function submitMikrotikCredentials(expiryTime) {
        const statusElement = document.getElementById("status");
        if (statusElement) statusElement.innerText = "Authenticating with Wi-Fi...";

        const linkLogin = params.get("link-login-only") || `http://${routerIp}/login`;

        // Direct form submission to local hotspot gateway
        const form = document.createElement("form");
        form.method = "POST";
        form.action = linkLogin;

        // Send username & password
        const user = document.createElement("input");
        user.type = "hidden";
        user.name = "username";
        user.value = phone;
        form.appendChild(user);

        const pass = document.createElement("input");
        pass.type = "hidden";
        pass.name = "password";
        pass.value = phone;
        form.appendChild(pass);

        // Append expiryTime as query param so page can render timer after redirect
        let redirectUrl = window.location.href;
        if (expiryTime && !redirectUrl.includes("expiryTime=")) {
            const separator = redirectUrl.includes("?") ? "&" : "?";
            redirectUrl += `${separator}expiryTime=${encodeURIComponent(expiryTime)}`;
        }

        const dst = document.createElement("input");
        dst.type = "hidden";
        dst.name = "dst";
        dst.value = redirectUrl;
        form.appendChild(dst);

        document.body.appendChild(form);
        form.submit();
    }

    // 3. Countdown Engine
    const expiryFromQuery = params.get("expiryTime");
    if (expiryFromQuery) {
        const statusElement = document.getElementById("status");
        if (statusElement) statusElement.innerText = "Connected";
        startTimerFromExpiry(new Date(expiryFromQuery));
    } else {
        startStatusPolling();
    }

    function startTimerFromExpiry(expiryDate) {
        if (countdownInterval) clearInterval(countdownInterval);

        function tick() {
            const now = Date.now();
            const diff = expiryDate.getTime() - now;

            if (diff <= 0) {
                renderExpiredState();
                return;
            }

            const totalSeconds = Math.floor(diff / 1000);
            displayTime(totalSeconds);
        }

        tick();
        countdownInterval = setInterval(tick, 1000);
    }

    function displayTime(seconds) {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        const timeString = `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

        const timerElement = document.getElementById("timer") || document.getElementById("remainingTime");
        if (timerElement) {
            timerElement.innerText = timeString;
        }
    }

    function renderExpiredState() {
        if (countdownInterval) clearInterval(countdownInterval);
        if (statusPollInterval) clearInterval(statusPollInterval);

        const timerElement = document.getElementById("timer") || document.getElementById("remainingTime");
        if (timerElement) timerElement.innerText = "Expired";

        const statusElement = document.getElementById("status");
        if (statusElement) statusElement.innerText = "Expired";
    }
});

function buyMore() {
    window.location.href = "/payment.html";
}