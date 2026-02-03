const nodemailer = require('nodemailer');
require('dotenv').config({ path: './backend/.env' });

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5000';

// Create Reusable Transporter (Industry Standard SMTP)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

/**
 * Send Verification Email
 */
exports.sendVerificationEmail = async (email, token) => {
    try {
        const verifyLink = `${CLIENT_URL}/api/auth/verify-email?token=${token}`;

        await transporter.sendMail({
            from: `"InnerSpark Support" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Verify your InnerSpark Account',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #4a90e2;">Welcome to InnerSpark!</h2>
                    <p>Please click the button below to verify your email address:</p>
                    <a href="${verifyLink}" style="background-color: #4a90e2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a>
                    <p style="margin-top: 20px; font-size: 12px; color: #777;">If you didn't create an account, you can ignore this email.</p>
                </div>
            `
        });
        console.log(`✅ Verification email sent to ${email} (via SMTP)`);
    } catch (error) {
        console.error('❌ Error sending verification email:', error);
        throw error;
    }
};

/**
 * Send Password Reset Email
 */
exports.sendPasswordResetEmail = async (email, token) => {
    try {
        const resetLink = `${CLIENT_URL}/reset-password.html?token=${token}`;

        await transporter.sendMail({
            from: `"InnerSpark Security" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Reset your InnerSpark Password',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #d9534f;">Password Reset Request</h2>
                    <p>You requested a password reset. Click the button below to set a new password:</p>
                    <a href="${resetLink}" style="background-color: #d9534f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
                    <p style="margin-top: 20px;">Or copy this link: <br> <a href="${resetLink}">${resetLink}</a></p>
                    <p style="margin-top: 20px; font-size: 12px; color: #777;">This link expires in 1 hour.</p>
                </div>
            `
        });
        console.log(`✅ Password reset email sent to ${email} (via SMTP)`);
    } catch (error) {
        console.error('❌ Error sending reset email:', error);
        throw error; // Throw error so controller handles it
    }
};
