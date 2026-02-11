const { User, Payment, Course, Coupon } = require('../models/index');

// Simulate Payment Process
exports.processPayment = async (req, res) => {
    try {
        const { courseID, paymentMethod } = req.body;
        const studentID = req.user.id;

        // 1. Fetch Course
        const course = await Course.findById(courseID);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        // 2. Check if already enrolled
        const user = await User.findById(studentID);
        if (user.enrolledCourses.includes(courseID)) {
            return res.status(400).json({ message: 'Already enrolled in this path' });
        }

        // 3. Calculate Global Price with Coupon
        let finalAmount = course.price;
        if (req.body.couponCode) {
            const coupon = await Coupon.findOne({ code: req.body.couponCode.toUpperCase(), active: true });
            if (coupon) {
                finalAmount = course.price * (1 - coupon.discountPercent / 100);
            }
        }

        // 4. Create Payment Entry (Simulated Success)
        const payment = new Payment({
            transactionID: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            studentID: studentID,
            courseID: courseID,
            amount: finalAmount,
            paymentMethod: paymentMethod || 'Card',
            status: 'Success'
        });

        await payment.save();

        // 4. Update User Enrollment & Create Record
        user.enrolledCourses.push(courseID);
        await user.save();

        const { Enrollment } = require('../models/index');
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1 Year Access

        const enrollment = new Enrollment({
            studentID,
            courseID,
            expiryDate
        });
        await enrollment.save();

        res.status(200).json({
            message: 'Enrollment successful! Your course is unlocked for 1 year.',
            transactionID: payment.transactionID
        });

    } catch (err) {
        res.status(500).json({ message: 'Payment failed', error: err.message });
    }
};

// Get User's Payments
exports.getMyPayments = async (req, res) => {
    try {
        const payments = await Payment.find({ studentID: req.user.id }).populate('courseID', 'title');
        res.status(200).json(payments);
    } catch (err) {
        res.status(500).json({ message: 'Fetch failed', error: err.message });
    }
};

// Validate Coupon
exports.validateCoupon = async (req, res) => {
    try {
        const { code } = req.body;
        const coupon = await Coupon.findOne({ code: code.toUpperCase(), active: true });

        if (!coupon) return res.status(404).json({ message: 'Invalid or expired secret code.' });

        if (coupon.expiryDate && new Date() > coupon.expiryDate) {
            return res.status(400).json({ message: 'This code has retreated into the past.' });
        }

        res.status(200).json({
            message: 'Grace applied!',
            discountPercent: coupon.discountPercent
        });
    } catch (err) {
        res.status(500).json({ message: 'Validation failed' });
    }
};
