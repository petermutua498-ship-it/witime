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

// --------------------------
// Load Packages
// --------------------------

async function loadPackages() {

    try {

        const response = await fetch("/api/packages");

        const packages = await response.json();

        packageContainer.innerHTML = "";

       packages.forEach(pkg => {

    const name = pkg.name || pkg.packageName;
    const price = pkg.price || pkg.packagePrice;
    const duration = pkg.duration || pkg.packageDuration;

    packageContainer.innerHTML += `

    <div class="package-card">

        <h3>${name}</h3>

        <p>KES ${pkg.price}</p>

        <small>${pkg.duration} ${pkg.durationUnit}</small>

        <br><br>

        <button onclick="selectPackage(
            '${pkg.name}',
            'KES ${pkg.price}',
            '${pkg.duration} ${pkg.durationUnit}'
        )">

            Choose Package

        </button>

    </div>

    `;

});
    } catch (err) {

        console.log(err);

        alert("Unable to load packages.");

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

// --------------------------
// Pay Button
// --------------------------

payBtn.onclick = async function () {

    let phone = phoneInput.value.trim();

    if (!phone) {

        alert("Enter phone number.");

        return;

    }

    if (phone.startsWith("07")) {

        phone = "254" + phone.substring(1);

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

                phone,

                packageName: currentPackage.name,

                packagePrice: currentPackage.price,

                packageDuration: currentPackage.duration

            })

        });

        const data = await response.json();

        if (!data.success) {

            alert(data.message);

            payBtn.disabled = false;
            payBtn.innerText = "Pay with M-Pesa";

            return;

        }

        paymentSection.style.display = "none";

        waitingSection.style.display = "block";

        timer = setInterval(async () => {

            const r = await fetch(`/check-payment/${phone}`);

            const result = await r.json();

            if (result.status === "success") {

                clearInterval(timer);

                waitingSection.style.display = "none";

                successSection.style.display = "block";

                setTimeout(() => {

                    window.location.href =
                        `/connected.html?phone=${phone}`;

                }, 2000);

            }

        }, 3000);

    } catch (err) {

        console.log(err);

        alert("Unable to contact server.");

        payBtn.disabled = false;
        payBtn.innerText = "Pay with M-Pesa";

    }

};