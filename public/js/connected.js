document.addEventListener("DOMContentLoaded", () => {

    const params = new URLSearchParams(window.location.search);

    const phone = params.get("phone");

    if (!phone) {

        alert("Phone number missing.");

        window.location.href = "/";

        return;

    }


    // ======================================
    // ELEMENTS
    // ======================================

    const phoneElement =
        document.getElementById("phone");

    const packageElement =
        document.getElementById("package");

    const connectedAtElement =
        document.getElementById("connectedAt");

    const expiresAtElement =
        document.getElementById("expiresAt");

    const remainingTimeElement =
        document.getElementById("remainingTime");


    // ======================================
    // BASIC INFORMATION
    // ======================================

    phoneElement.innerText = phone;

    packageElement.innerText =
        localStorage.getItem("packageName") ||
        "Wi-Fi Package";


    // ======================================
    // COUNTDOWN
    // ======================================

    let countdownInterval = null;


    function startCountdown(expiryTime) {

        if (countdownInterval) {

            clearInterval(countdownInterval);

        }


        const expiry =
            new Date(expiryTime).getTime();


        function updateTimer() {

            const now = Date.now();

            const remaining =
                expiry - now;


            if (remaining <= 0) {

                remainingTimeElement.innerText =
                    "00:00:00";

                clearInterval(countdownInterval);

                return;

            }


            const totalSeconds =
                Math.floor(remaining / 1000);


            const hours =
                Math.floor(totalSeconds / 3600);


            const minutes =
                Math.floor(
                    (totalSeconds % 3600) / 60
                );


            const seconds =
                totalSeconds % 60;


            remainingTimeElement.innerText =

                String(hours).padStart(2, "0") +
                ":" +
                String(minutes).padStart(2, "0") +
                ":" +
                String(seconds).padStart(2, "0");

        }


        updateTimer();

        countdownInterval =
            setInterval(updateTimer, 1000);

    }


    // ======================================
    // CHECK CONNECTION
    // ======================================

    async function checkConnection() {

        try {

            const response =
                await fetch(
                    `/api/connected/${encodeURIComponent(phone)}`,
                    {
                        cache: "no-store"
                    }
                );


            if (!response.ok) {

                console.log(
                    "Waiting for payment..."
                );

                return;

            }


            const data =
                await response.json();


            console.log(
                "WiTime connection:",
                data
            );


            // ==================================
            // PACKAGE
            // ==================================

            if (data.packageName) {

                packageElement.innerText =
                    data.packageName;

            }


            // ==================================
            // LOGIN TIME
            // ==================================

            if (data.loginTime) {

                connectedAtElement.innerText =
                    new Date(
                        data.loginTime
                    ).toLocaleString();

            }


            // ==================================
            // EXPIRY TIME
            // ==================================

            if (data.expiryTime) {

                expiresAtElement.innerText =
                    new Date(
                        data.expiryTime
                    ).toLocaleString();


                startCountdown(
                    data.expiryTime
                );

            }


            // ==================================
            // STATUS
            // ==================================

            const status =
                String(data.status || "")
                    .toLowerCase();


            if (
                status === "paid" ||
                status === "online" ||
                status === "active" ||
                status === "success"
            ) {

                console.log(
                    "Payment/connection active."
                );

            }


            if (
                status === "expired"
            ) {

                remainingTimeElement.innerText =
                    "00:00:00";

            }

        } catch (error) {

            console.error(
                "Connection check error:",
                error
            );

        }

    }


    // ======================================
    // START
    // ======================================

    checkConnection();


    // Check every 3 seconds

    setInterval(
        checkConnection,
        3000
    );


    // ======================================
    // BUY AGAIN
    // ======================================

    const buyAgain =
        document.getElementById("buyAgain");


    if (buyAgain) {

        buyAgain.addEventListener(
            "click",
            () => {

                window.location.href =
                    "/payment.html";

            }
        );

    }

});