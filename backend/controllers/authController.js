const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models/index');
const emailService = require('../utils/emailService');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

/**
 * Generate Unique ID based on Role
 * Robust logic: Access last created user to determine sequence.
 */
const generateID = async (role) => {
    const year = new Date().getFullYear();
    const prefix = role === 'Student' ? 'STU' : (role === 'Staff' ? 'STF' : 'ADM');

    // Regex to match the current role and year pattern (e.g., STU-2026-)
    const regex = new RegExp(`^${prefix}-${year}-`);

    // Find the highest studentID matching the pattern
    const lastUser = await User.findOne({
        role,
        studentID: { $regex: regex }
    }).sort({ studentID: -1 });

    let sequence = '0001';
    if (lastUser && lastUser.studentID) {
        const parts = lastUser.studentID.split('-');
        if (parts.length === 3) {
            const lastSeq = parseInt(parts[2], 10);
            if (!isNaN(lastSeq)) {
                sequence = String(lastSeq + 1).padStart(4, '0');
            }
        }
    }

    return `${prefix}-${year}-${sequence}`;
};

// Register User
exports.register = catchAsync(async (req, res, next) => {
    console.log('👉 Register Request Body:', req.body);
    const { name, email, password, role, phone, address, gender, dob } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return next(new AppError('User already exists', 400));

    const hashedPassword = await bcrypt.hash(password, 10);
    const studentID = await generateID(role);

    let profilePicPath = '';
    if (req.file) profilePicPath = req.file.path;

    const newUser = new User({
        name,
        email,
        password: hashedPassword,
        role,
        studentID,
        phone,
        address,
        gender,
        dob,
        profilePic: profilePicPath,
        verificationToken: crypto.randomBytes(32).toString('hex')
    });

    await newUser.save();

    // Non-blocking email send (log error if fail, don't crash request)
    try {
        await emailService.sendVerificationEmail(newUser.email, newUser.verificationToken);
    } catch (err) {
        console.error('Email send failed:', err);
    }

    res.status(201).json({
        status: 'success',
        message: 'Registration successful! Please check your email to verify your account.',
        studentID
    });
});

// Login User
exports.login = catchAsync(async (req, res, next) => {
    const { identifier, password } = req.body; // Can be email or studentID

    if (!identifier || !password) {
        return next(new AppError('Please provide email and password!', 400));
    }

    const user = await User.findOne({
        $or: [{ email: identifier }, { studentID: identifier }]
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return next(new AppError('Incorrect email or password', 401));
    }

    // Check Maintenance Mode
    const Settings = require('../models/Settings');
    const settings = await Settings.findOne();
    if (settings && settings.isMaintenanceMode && user.role !== 'Admin') {
        return res.status(503).json({
            message: settings.maintenanceMessage || 'System under maintenance. Only Admins can log in.',
            maintenance: true
        });
    }

    // Check Verification Status
    if (!user.isVerified) {
        return next(new AppError('Please verify your email address to login.', 403));
    }

    const token = jwt.sign(
        { id: user._id, role: user.role, name: user.name },
        process.env.JWT_SECRET || 'innerspark_secret_key',
        { expiresIn: '24h' }
    );

    res.status(200).json({
        status: 'success',
        token,
        user: {
            id: user._id,
            name: user.name,
            role: user.role,
            studentID: user.studentID,
            profilePic: user.profilePic
        }
    });
});

// Get Profile
exports.getProfile = catchAsync(async (req, res, next) => {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return next(new AppError('User not found', 404));

    res.status(200).json({
        status: 'success',
        data: { user }
    });
});

// Update Profile
exports.updateProfile = catchAsync(async (req, res, next) => {
    const updates = req.body;
    // Filter out unwanted fields
    ['password', 'role', 'studentID', 'email'].forEach(field => delete updates[field]);

    if (req.file) {
        if (req.file.size < 5120 || req.file.size > 51200) {
            // const fs = require('fs');
            // fs.unlinkSync(req.file.path); // Cannot local unlink Cloudinary URL
            return next(new AppError('File too large or too small. Size must be between 5KB and 50KB.', 400));
        }
        updates.profilePic = req.file.path;
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true, runValidators: true }).select('-password');

    res.status(200).json({
        status: 'success',
        message: 'Profile updated successfully',
        data: { user }
    });
});

// Change Password
exports.changePassword = catchAsync(async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    if (!(await bcrypt.compare(currentPassword, user.password))) {
        return next(new AppError('Current password is incorrect', 401));
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({
        status: 'success',
        message: 'Password changed successfully'
    });
});

// Verify Email
exports.verifyEmail = catchAsync(async (req, res, next) => {
    const { token } = req.query;
    const user = await User.findOne({ verificationToken: token });

    if (!user) {
        return res.status(400).send('<h1>Invalid or expired verification token</h1>');
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.redirect(`${process.env.CLIENT_URL}/html/verify-success.html`);
});

// Resend Verification Email
exports.resendVerification = catchAsync(async (req, res, next) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) return next(new AppError('User not found', 404));
    if (user.isVerified) return next(new AppError('Account already verified', 400));

    if (!user.verificationToken) {
        user.verificationToken = crypto.randomBytes(32).toString('hex');
        await user.save();
    }

    await emailService.sendVerificationEmail(user.email, user.verificationToken);

    res.status(200).json({
        status: 'success',
        message: 'Verification email sent'
    });
});

// Forgot Password
exports.forgotPassword = catchAsync(async (req, res, next) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) return next(new AppError('There is no user with that email address.', 404));

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 Hour

    await user.save({ validateBeforeSave: false });

    try {
        await emailService.sendPasswordResetEmail(user.email, resetToken);
        res.status(200).json({
            status: 'success',
            message: 'Token sent to email!'
        });
    } catch (err) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save({ validateBeforeSave: false });
        return next(new AppError('There was an error sending the email. Try again later!', 500));
    }
});

// Reset Password
exports.resetPassword = catchAsync(async (req, res, next) => {
    const { token, newPassword } = req.body;

    // Find user by token and ensure token is not expired
    const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) return next(new AppError('Token is invalid or has expired', 400));

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.status(200).json({
        status: 'success',
        message: 'Password has been reset successfully'
    });
});
