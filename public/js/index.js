// ==========================
// WiTime Landing Page
// ==========================

const packageContainer = document.getElementById("packages");

const paymentSection = document.getElementById("paymentSection");
const waitingSection = document.getElementById("waitingSection");
const successSection = document.getElementById("successSection");

const selectedPackage = document.getElementById("selectedPackage");
const selectedPrice = document.getElementById("selectedPrice");

const phoneInput = document.getElementById("phone");
const payBtn = document.getElementById("payBtn");

let currentPackage = null;
let timer = null;


async function loadPackages() {
    try {
        const response = await fetch("/api/packages", {
            method: "GET",
            credentials: "include",
            cache: "no-store"
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Unable to load packages."
            );
        }

        if (!Array.isArray(data)) {
            console.error("Unexpected packages response:", data);
            throw new Error("Server did not return a package list.");
        }

        packageContainer.innerHTML = "";

        if (data.length === 0) {
            packageContainer.innerHTML =
                "<p>No packages have been created yet.</p>";
            return;
        }

        data.forEach(pkg => {
            const card = document.createElement("div");
            card.className = "package-card";

            const heading = document.createElement("h3");
            heading.textContent = pkg.name;

            const price = document.createElement("p");
            price.textContent = `KES ${pkg.price}`;

            const duration = document.createElement("small");
            duration.textContent =
                `${pkg.duration} ${pkg.durationUnit}`;

            const button = document.createElement("button");
            button.textContent = "Choose Package";

            button.addEventListener("click", () => {
                selectPackage(
                    pkg.name,
                    `KES ${pkg.price}`,
                    `${pkg.duration} ${pkg.durationUnit}`
                );
            });

            card.append(heading, price, duration, button);
            packageContainer.appendChild(card);
        });

    } catch (err) {
        console.error("Load packages error:", err);
        packageContainer.innerHTML =
            "<p>Unable to load packages. Please try again.</p>";
    }
}


loadPackages();

// --------------------------
// Package Selected
// --------------------------

window.selectPackage = function(name, price, duration) {

    currentPackage = {
        name,
        price,
        duration
    };

    // Display selected package
    selectedPackage.innerText = name;
    selectedPrice.innerText = `${price} • ${duration}`;

    // Show payment section
    paymentSection.style.display = "block";

    // Scroll to payment section
    setTimeout(() => {

        paymentSection.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

        // Automatically place cursor in phone number box
        setTimeout(() => {

            phoneInput.focus();

        }, 500);

    }, 100);

}; 

// ==========================
// Pay Button
// ==========================

payBtn.onclick = async function () {

    let phone = phoneInput.value.trim();

    if (!phone) {
        alert("Enter phone number.");
        return;
    }

    // Convert 07XXXXXXXX to 2547XXXXXXXX
    if (phone.startsWith("07")) {
        phone = "254" + phone.substring(1);
    }

    // Convert +2547XXXXXXXX to 2547XXXXXXXX
    if (phone.startsWith("+254")) {
        phone = phone.substring(1);
    }

    if (!/^254[17]\d{8}$/.test(phone)) {
        alert("Enter a valid Kenyan phone number.");
        return;
    }

    if (!currentPackage) {
        alert("Please select a package.");
        return;
    }

    payBtn.disabled = true;
    payBtn.innerText = "Sending STK...";

    try {

        const response = await fetch("/api/pay", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                phone: phone,

                packageName: currentPackage.name,

                packagePrice: currentPackage.price,

                packageDuration: currentPackage.duration

            })

        });

        // Prevent HTML 404 pages from causing JSON errors
        const text = await response.text();

        let data;

        try {
            data = JSON.parse(text);
        } catch (jsonError) {

            console.error(
                "Server returned non-JSON:",
                text
            );

            throw new Error(
                `Server returned ${response.status}`
            );
        }

        if (!response.ok || !data.success) {

            throw new Error(
                data.message ||
                "Payment request failed."
            );

        }

        // --------------------------
        // STK SENT
        // --------------------------

        paymentSection.style.display = "none";

        waitingSection.style.display = "block";

        payBtn.disabled = false;
        payBtn.innerText = "Pay with M-Pesa";

        // Clear previous timer
        if (timer) {
            clearInterval(timer);
        }

        // --------------------------
        // CHECK PAYMENT
        // --------------------------

        timer = setInterval(async () => {

            try {

                const r = await fetch(
                    `/api/check-payment/${encodeURIComponent(phone)}`,
                    {
                        cache: "no-store"
                    }
                );

                const resultText =
                    await r.text();

                let result;

                try {
                    result = JSON.parse(resultText);
                } catch (e) {

                    console.error(
                        "Invalid payment status response:",
                        resultText
                    );

                    return;
                }

                console.log(
                    "Payment status:",
                    result
                );

                if (
                    result.status === "Paid" ||
                    result.status === "success" ||
                    result.status === "Success"
                ) {

                    clearInterval(timer);

                    waitingSection.style.display =
                        "none";

                    successSection.style.display =
                        "block";

                    setTimeout(() => {

                        window.location.href =
                            `/connected.html?phone=${encodeURIComponent(phone)}`;

                    }, 2000);

                }

                if (
                    result.status === "Failed" ||
                    result.status === "failed"
                ) {

                    clearInterval(timer);

                    waitingSection.style.display =
                        "none";

                    paymentSection.style.display =
                        "block";

                    alert(
                        "Payment was cancelled or failed."
                    );

                    payBtn.disabled = false;

                    payBtn.innerText =
                        "Pay with M-Pesa";

                }

            } catch (error) {

                console.error(
                    "Payment checking error:",
                    error
                );

            }

        }, 3000);

    } catch (err) {

        console.error(
            "Payment error:",
            err
        );

        alert(
            err.message ||
            "Unable to contact server."
        );

        payBtn.disabled = false;

        payBtn.innerText =
            "Pay with M-Pesa";

    }

};