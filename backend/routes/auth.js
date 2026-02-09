const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { upload } = require('../controllers/uploadController');

// Multi-step Registration Flow
// @route   POST /api/auth/send-registration-otp
// @desc    Step 1: Send OTP to email for verification
router.post('/send-registration-otp', authController.sendRegistrationOTP);

// @route   POST /api/auth/verify-registration-otp
// @desc    Step 2: Verify the OTP sent to email
router.post('/verify-registration-otp', authController.verifyRegistrationOTP);

// @route   POST /api/auth/complete-registration
// @desc    Step 3: Complete registration with password
router.post('/complete-registration', upload.single('profilePic'), authController.completeRegistration);

// @route   POST /api/auth/register (Legacy - keep for backwards compatibility)
// @desc    Register a new user (Student/Staff/Admin)
router.post('/register', upload.single('profilePic'), authController.register);

const authorize = require('../middleware/auth');

// @route   POST /api/auth/login
// @desc    Login with Email or Unique ID
router.post('/login', authController.login);

// @route   GET /api/auth/profile
// @desc    Get Current User Profile
router.get('/profile', authorize(), authController.getProfile);

// @route   PUT /api/auth/profile
// @desc    Update User Profile
router.put('/profile', authorize(), upload.single('profilePic'), authController.updateProfile);

// @route   PUT /api/auth/change-password
// @desc    Change Password
router.put('/change-password', authorize(), authController.changePassword);

// @route   GET /api/auth/verify-email
// @desc    Verify Email Token
router.get('/verify-email', authController.verifyEmail);

// @route   POST /api/auth/resend-verification
// @desc    Resend Verification Email
router.post('/resend-verification', authController.resendVerification);

// @route   GET /api/auth/ping
router.get('/ping', (req, res) => res.send('pong'));

// @route   GET /api/auth/validate
// @desc    Validate token and session - used for security checks
router.get('/validate', authorize(), (req, res) => {
    // If we reach here, token is valid (authorize middleware passed)
    res.status(200).json({
        valid: true,
        user: {
            id: req.user.id,
            role: req.user.role,
            name: req.user.name
        }
    });
});

// @route   POST /api/auth/forgot-password
// @desc    Request Password Reset
router.post('/forgot-password', (req, res, next) => {
    console.log('👉 Hit POST /forgot-password');
    next();
}, authController.forgotPassword);

// @route   POST /api/auth/reset-password
// @desc    Reset Password with Token
router.post('/reset-password', authController.resetPassword);

// @route   POST /api/auth/cleanup-incomplete-registrations
// @desc    Cleanup incomplete registrations (Admin only or internal cron job)
router.post('/cleanup-incomplete-registrations', authController.cleanupIncompleteRegistrations);

module.exports = router;
