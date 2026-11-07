
document.addEventListener("DOMContentLoaded", async () => {
    const tableBody = document.getElementById("routerTableBody");
    const routerForm = document.getElementById("routerForm");
    const alertBox = document.getElementById("alertBox");
    const submitBtn = document.getElementById("submitBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const refreshBtn = document.getElementById("refreshRoutersBtn");

    let alertTimer;

    function showAlert(message, type = "error") {
        clearTimeout(alertTimer);

        alertBox.textContent = message;
        alertBox.hidden = false;
        alertBox.className =
            `notice ${type === "success" ? "notice-success" : "notice-error"}`;

        alertTimer = setTimeout(() => {
            alertBox.hidden = true;
        }, 4000);
    }

    async function apiRequest(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            credentials: "include",
            headers: {
                ...(options.body ? { "Content-Type": "application/json" } : {}),
                ...options.headers,
            },
        });

        if (response.status === 401) {
            window.location.replace("/login.html");
            throw new Error("Your login session has expired.");
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.message || "The request failed.");
        }

        return data;
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        })[char]);
    }

    async function checkAccount() {
        const data = await apiRequest("/api/auth/me");

        if (!data.success || !data.account) {
            window.location.replace("/login.html");
            return false;
        }

        document.getElementById("accountName").textContent =
            data.account.name || "WiTime User";

        return true;
    }

    async function loadRouters() {
        tableBody.innerHTML = `
            <tr><td colspan="5" class="empty-state">Loading routers...</td></tr>
        `;

        try {
            const data = await apiRequest("/api/routers");
            const routers = Array.isArray(data) ? data : data.routers;

            if (!Array.isArray(routers)) {
                throw new Error("Unexpected response from the routers API.");
            }

            if (routers.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="empty-state">
                            No routers registered. Add your first router above.
                        </td>
                    </tr>
                `;
                return;
            }

            tableBody.innerHTML = routers.map(router => {
                const online = router.isOnline === true;
                const routerId = escapeHtml(router._id);

                return `
                    <tr>
                        <td><strong>${escapeHtml(router.name)}</strong></td>
                        <td>
                            <code>${escapeHtml(router.ip)}:${escapeHtml(router.port || 8728)}</code>
                        </td>
                        <td>${Number(router.activeUsersCount) || 0}</td>
                        <td>
                            <span class="router-status ${online ? "online" : "offline"}">
                                ${online ? "● Online" : "● Offline / Unknown"}
                            </span>
                        </td>
                        <td>
                            <div class="router-actions">
                                <button type="button"
                                    data-action="sync"
                                    data-id="${routerId}">
                                    Sync Tiers
                                </button>
                                <button type="button"
                                    data-action="delete"
                                    data-id="${routerId}"
                                    class="danger-button">
                                    Remove
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join("");
        } catch (error) {
            console.error("Router loading failed:", error);

            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        ${escapeHtml(error.message || "Failed to load routers.")}
                    </td>
                </tr>
            `;
        }
    }

    routerForm.addEventListener("submit", async event => {
        event.preventDefault();

        const name = document.getElementById("routerName").value.trim();
        const ip = document.getElementById("routerIp").value.trim();
        const port = Number(document.getElementById("routerPort").value);
        const username = document.getElementById("routerUser").value.trim();
        const password = document.getElementById("routerPass").value;

        if (!name || !ip || !username || !password || !Number.isInteger(port) ||
            port < 1 || port > 65535) {
            showAlert("Enter valid details for all router fields.");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Testing Connection...";

        try {
            const result = await apiRequest("/api/routers", {
                method: "POST",
                body: JSON.stringify({ name, ip, port, username, password }),
            });

            routerForm.reset();
            document.getElementById("routerPort").value = "8728";

            showAlert(
                result.message || "Router saved successfully.",
                "success"
            );

            await loadRouters();
        } catch (error) {
            showAlert(error.message || "Failed to connect to the router.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Connect & Save Router";
        }
    });

    tableBody.addEventListener("click", async event => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;

        const id = button.dataset.id;
        const action = button.dataset.action;

        if (!id || !/^[a-f\d]{24}$/i.test(id)) {
            showAlert("Invalid router ID.");
            return;
        }

        button.disabled = true;

        try {
            if (action === "sync") {
                const result = await apiRequest(
                    `/api/routers/${encodeURIComponent(id)}/sync`,
                    { method: "POST" }
                );

                showAlert(result.message || "Router profiles synchronized.", "success");
            }

            if (action === "delete") {
                if (!confirm("Remove this router from your WiTime account?")) {
                    return;
                }

                const result = await apiRequest(
                    `/api/routers/${encodeURIComponent(id)}`,
                    { method: "DELETE" }
                );

                showAlert(result.message || "Router removed.", "success");
                await loadRouters();
            }
        } catch (error) {
            showAlert(error.message || "The operation failed.");
        } finally {
            button.disabled = false;
        }
    });

    refreshBtn.addEventListener("click", loadRouters);

    logoutBtn.addEventListener("click", async () => {
        logoutBtn.disabled = true;

        try {
            await apiRequest("/api/auth/logout", { method: "POST" });
        } catch (error) {
            console.error("Logout request failed:", error);
        } finally {
            window.location.replace("/login.html");
        }
    });

    try {
        const authenticated = await checkAccount();

        if (authenticated) {
            await loadRouters();
        }
    } catch (error) {
        console.error("Account verification failed:", error);
        window.location.replace("/login.html");
    }
});
