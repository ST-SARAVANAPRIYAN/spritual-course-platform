/**
 * InnerSpark - Secure Checkout Logic
 */

let selectedMethod = 'Card';
let courseID = null;
let basePrice = 0;
let discountPercent = 0;
let appliedCoupon = null;

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    courseID = params.get('course');

    if (!courseID) {
        window.location.href = 'marketplace.html';
        return;
    }

    if (!Auth.isLoggedIn()) {
        alert('Please login to begin your enrollment.');
        window.location.href = 'login.html';
        return;
    }

    await loadOrderDetails();

    document.getElementById('completePayment').addEventListener('click', processCheckout);
});

async function loadOrderDetails() {
    try {
        const res = await fetch(`${Auth.apiBase}/courses/${courseID}`, { headers: Auth.getHeaders() });
        const { course } = await res.json();

        basePrice = course.price;
        document.getElementById('courseName').textContent = course.title;
        document.getElementById('courseCat').textContent = course.category;
        document.getElementById('courseThumb').src = course.thumbnail || 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80';
        document.getElementById('coursePrice').textContent = `$${basePrice}`;

        updateTotals();
    } catch (err) {
        console.error(err);
    }
}

function selectPayment(el, method) {
    document.querySelectorAll('.payment-option').forEach(opt => opt.classList.remove('active'));
    el.classList.add('active');
    selectedMethod = method;
}

async function applyCoupon() {
    const code = document.getElementById('couponCode').value.trim();
    if (!code) return;

    try {
        const res = await fetch(`${Auth.apiBase}/payments/validate-coupon`, {
            method: 'POST',
            headers: Auth.getHeaders(),
            body: JSON.stringify({ code })
        });
        const data = await res.json();

        if (res.ok) {
            discountPercent = data.discountPercent;
            appliedCoupon = code.toUpperCase();
            alert('Grace code applied! InnerSpark welcomes you.');
            updateTotals();
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Connection to the treasury failed.');
    }
}

function updateTotals() {
    const discount = (basePrice * discountPercent) / 100;
    const final = basePrice - discount;

    if (discount > 0) {
        document.getElementById('discountRow').style.display = 'flex';
        document.getElementById('discountAmt').textContent = `-$${discount.toFixed(2)}`;
    }

    document.getElementById('finalPrice').textContent = `$${final.toFixed(2)}`;
}

async function processCheckout() {
    const btn = document.getElementById('completePayment');
    btn.textContent = 'Processing Transaction...';
    btn.disabled = true;

    try {
        const res = await fetch(`${Auth.apiBase}/payments/process`, {
            method: 'POST',
            headers: Auth.getHeaders(),
            body: JSON.stringify({
                courseID: courseID,
                paymentMethod: selectedMethod,
                couponCode: appliedCoupon
            })
        });

        const data = await res.json();
        if (res.ok) {
            document.getElementById('successModal').style.display = 'flex';
        } else {
            alert(data.message);
            btn.textContent = 'Complete Enrollment';
            btn.disabled = false;
        }
    } catch (err) {
        alert('Transaction failed. Check your connection.');
        btn.textContent = 'Complete Enrollment';
        btn.disabled = false;
    }
}
