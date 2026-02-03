const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const upload = require('../middleware/upload');

// @route   POST /api/auth/register
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

// @route   POST /api/auth/forgot-password
// @desc    Request Password Reset
router.post('/forgot-password', authController.forgotPassword);

// @route   POST /api/auth/reset-password
// @desc    Reset Password with Token
router.post('/reset-password', authController.resetPassword);

module.exports = router;
