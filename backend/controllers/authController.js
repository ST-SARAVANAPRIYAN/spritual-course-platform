const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models/index');
const emailService = require('../utils/emailService');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

// Generate 6-digit OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

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

// Step 1: Send OTP for Email Verification (New Registration Flow)
exports.sendRegistrationOTP = catchAsync(async (req, res, next) => {
    const { email, name } = req.body;

    if (!email || !name) {
        return next(new AppError('Email and name are required', 400));
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return next(new AppError('Please provide a valid email address', 400));
    }

    // Check if user already exists with verified account
    const existingVerifiedUser = await User.findOne({ email, isVerified: true });
    if (existingVerifiedUser) {
        return next(new AppError('Email already registered. Please login instead.', 400));
    }

    // Clean up old incomplete registrations (older than 24 hours or with expired OTP)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await User.deleteMany({
        email,
        isVerified: false,
        $or: [
            { createdAt: { $lt: oneDayAgo } },
            { registrationOTPExpires: { $lt: new Date() } }
        ]
    });

    // Generate 6-digit OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create temporary user record with OTP (or update if exists)
    let tempUser = await User.findOne({ email, isVerified: false });
    
    if (tempUser) {
        // Update existing temp user
        tempUser.registrationOTP = otp;
        tempUser.registrationOTPExpires = otpExpires;
        tempUser.registrationOTPAttempts = 0;
        tempUser.name = name;
        await tempUser.save();
    } else {
        // Create new temp user
        tempUser = new User({
            email,
            name,
            registrationOTP: otp,
            registrationOTPExpires: otpExpires,
            registrationOTPAttempts: 0,
            role: 'Student', // Default role
            password: 'temp_password_to_be_set', // Temporary password
            isVerified: false
        });
        await tempUser.save();
    }

    // Send OTP via email using Resend
    try {
        await emailService.sendRegistrationOTP(email, otp, name);
        
        res.status(200).json({
            status: 'success',
            message: 'OTP sent to your email. Valid for 10 minutes.',
            email: email
        });
    } catch (error) {
        console.error('Failed to send OTP email:', error);
        return next(new AppError('Failed to send OTP. Please try again.', 500));
    }
});

// Step 2: Verify OTP
exports.verifyRegistrationOTP = catchAsync(async (req, res, next) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return next(new AppError('Email and OTP are required', 400));
    }

    const user = await User.findOne({ email, isVerified: false });

    if (!user) {
        return next(new AppError('No pending registration found for this email', 404));
    }

    // Check if OTP has expired
    if (!user.registrationOTPExpires || user.registrationOTPExpires < new Date()) {
        return next(new AppError('OTP has expired. Please request a new one.', 400));
    }

    // Check attempt limit (max 5 attempts)
    if (user.registrationOTPAttempts >= 5) {
        // Delete the incomplete registration due to too many failed attempts
        await User.deleteOne({ _id: user._id });
        return next(new AppError('Too many failed attempts. Registration cancelled. Please start again.', 400));
    }

    // Verify OTP
    if (user.registrationOTP !== otp) {
        user.registrationOTPAttempts += 1;
        await user.save();
        
        const remainingAttempts = 5 - user.registrationOTPAttempts;
        return next(new AppError(`Invalid OTP. ${remainingAttempts} attempts remaining.`, 400));
    }

    // OTP is correct - mark as verified and clear OTP fields
    user.registrationOTP = undefined;
    user.registrationOTPExpires = undefined;
    user.registrationOTPAttempts = 0;
    await user.save();

    res.status(200).json({
        status: 'success',
        message: 'Email verified successfully. You can now set your password.',
        email: user.email
    });
});

// Step 3: Complete Registration with Password
exports.completeRegistration = catchAsync(async (req, res, next) => {
    const { email, password, phone, profilePic } = req.body;

    if (!email || !password) {
        return next(new AppError('Email and password are required', 400));
    }

    // Validate phone number if provided
    if (phone && !/^[0-9]{10}$/.test(phone)) {
        return next(new AppError('Phone number must be exactly 10 digits', 400));
    }

    const user = await User.findOne({ email, isVerified: false });

    if (!user) {
        return next(new AppError('No verified registration found. Please start again.', 404));
    }

    // Check if OTP was verified (OTP fields should be undefined)
    if (user.registrationOTP || user.registrationOTPExpires) {
        return next(new AppError('Please verify your email with OTP first', 400));
    }

    // Hash password and update user
    const hashedPassword = await bcrypt.hash(password, 10);
    const studentID = await generateID(user.role);

    user.password = hashedPassword;
    user.studentID = studentID;
    user.phone = phone || user.phone;
    user.isVerified = true;

    // Handle profile picture if provided
    if (req.file) {
        const fs = require('fs');
        const imageBuffer = fs.readFileSync(req.file.path);
        user.profilePic = `data:${req.file.mimetype};base64,${imageBuffer.toString('base64')}`;
        fs.unlinkSync(req.file.path);
    } else if (profilePic) {
        user.profilePic = profilePic;
    }

    await user.save();

    res.status(201).json({
        status: 'success',
        message: 'Registration completed successfully! You can now login.',
        studentID: user.studentID
    });
});

// Cleanup incomplete registrations (can be called by a cron job or manually)
exports.cleanupIncompleteRegistrations = catchAsync(async (req, res, next) => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const result = await User.deleteMany({
        isVerified: false,
        $or: [
            { createdAt: { $lt: oneDayAgo } },
            { registrationOTPExpires: { $lt: new Date() } }
        ]
    });

    console.log(`🧹 Cleaned up ${result.deletedCount} incomplete registrations`);
    
    res.status(200).json({
        status: 'success',
        message: `Cleaned up ${result.deletedCount} incomplete registrations`,
        deletedCount: result.deletedCount
    });
});

// Register User
exports.register = catchAsync(async (req, res, next) => {
    console.log('👉 Register Request Body:', req.body);
    const { name, email, password, role, phone, address, gender, dob } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return next(new AppError('User already exists', 400));

    const hashedPassword = await bcrypt.hash(password, 10);
    const studentID = await generateID(role);

    let profilePicBase64 = '';
    if (req.file) {
        // Convert uploaded file to base64
        const fs = require('fs');
        const imageBuffer = fs.readFileSync(req.file.path);
        profilePicBase64 = `data:${req.file.mimetype};base64,${imageBuffer.toString('base64')}`;
        
        // Delete the temporary file
        fs.unlinkSync(req.file.path);
    }

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
        profilePic: profilePicBase64,
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

    // Check if account is active
    if (user.active === false) {
        return next(new AppError('Your account is inactive. Please contact the administrator.', 403));
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

    // Update last login
    user.lastLogin = new Date();
    await user.save();

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
            profilePic: user.profilePic,
            lastLogin: user.lastLogin,
            isDefaultAdmin: user.isDefaultAdmin || false
        }
    });
});

// Get Profile
exports.getProfile = catchAsync(async (req, res, next) => {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return next(new AppError('User not found', 404));

    res.status(200).json({
        status: 'success',
        data: {
            id: user._id,
            name: user.name,
            role: user.role,
            email: user.email,
            studentID: user.studentID,
            phone: user.phone,
            profilePic: user.profilePic,
            active: user.active,
            isDefaultAdmin: user.isDefaultAdmin || false,
            lastLogin: user.lastLogin
        }
    });
});

// Update Profile
exports.updateProfile = catchAsync(async (req, res, next) => {
    const updates = req.body;
    // Filter out unwanted fields
    ['password', 'role', 'studentID', 'email'].forEach(field => delete updates[field]);

    if (req.file) {
        if (req.file.size < 5120 || req.file.size > 51200) {
            const fs = require('fs');
            fs.unlinkSync(req.file.path);
            return next(new AppError('File too large or too small. Size must be between 5KB and 50KB.', 400));
        }
        // Convert uploaded file to base64
        const fs = require('fs');
        const imageBuffer = fs.readFileSync(req.file.path);
        updates.profilePic = `data:${req.file.mimetype};base64,${imageBuffer.toString('base64')}`;
        
        // Delete the temporary file
        fs.unlinkSync(req.file.path);
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
