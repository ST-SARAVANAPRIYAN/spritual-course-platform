const { Resend } = require('resend');
require('dotenv').config({ path: './backend/.env' });

const resend = new Resend(process.env.RESEND_API_KEY);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5000';

/**
 * Send Verification Email
 * @param {string} email - Recipient email
 * @param {string} token - Verification token
 */
exports.sendVerificationEmail = async (email, token) => {
    try {
        const verifyLink = `${CLIENT_URL}/api/auth/verify-email?token=${token}`;

        await resend.emails.send({
            from: 'InnerSpark <onboarding@resend.dev>', // Change to your domain in production
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
        console.log(`✅ Verification email sent to ${email}`);
    } catch (error) {
        console.error('❌ Error sending verification email:', error);
        // Don't throw error to prevent blocking registration flow
    }
};

/**
 * Send Password Reset Email
 * @param {string} email - Recipient email
 * @param {string} token - Reset token
 */
exports.sendPasswordResetEmail = async (email, token) => {
    try {
        // Frontend URL for password reset page
        // Assumes you will have a frontend route /reset-password?token=...
        const resetLink = `${CLIENT_URL}/reset-password.html?token=${token}`;

        await resend.emails.send({
            from: 'InnerSpark <security@resend.dev>',
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
        console.log(`✅ Password reset email sent to ${email}`);
    } catch (error) {
        console.error('❌ Error sending reset email:', error);
    }
};
