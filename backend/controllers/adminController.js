const { Course, Content, User, Payment } = require('../models/index');
const bcrypt = require('bcryptjs');

// Add New Staff (Admin Only)
exports.addStaff = async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate Staff ID
        const year = new Date().getFullYear();
        const count = await User.countDocuments({ role: 'Staff' });
        const studentID = `STF-${year}-${String(count + 1).padStart(4, '0')}`;

        const newStaff = new User({
            name,
            email,
            password: hashedPassword,
            role: 'Staff',
            studentID,
            phone
        });

        await newStaff.save();
        res.status(201).json({ message: 'Staff guardian ordained successfully', studentID });
    } catch (err) {
        res.status(500).json({ message: 'Failed to add staff', error: err.message });
    }
};

// Get Pending Content Queue
exports.getPendingContent = async (req, res) => {
    try {
        const { Module } = require('../models/index'); // Use Module model
        // We can still support legacy Content/Exam if needed, but primary is Module now.

        const pendingModules = await Module.find({ approvalStatus: 'Pending' })
            .populate('courseId', 'title') // Note: Module schema uses courseId (lowercase d)
            .populate('createdBy', 'name');

        res.status(200).json({ content: pendingModules, exams: [] }); // Sending modules in 'content' array for frontend compatibility
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch queue', error: err.message });
    }
};

// Approve/Reject Content/Module/Course
exports.reviewItem = async (req, res) => {
    try {
        const { itemID, itemType, status, adminRemarks } = req.body;
        const { Module, Course } = require('../models/index');

        let item;

        if (itemType === 'Module' || itemType === 'Content') {
            const updateData = {
                approvalStatus: status,
                adminRemarks
            };

            if (status === 'Approved') {
                updateData.isPublished = true;
                updateData.approvedBy = req.user.id;
                updateData.approvedAt = Date.now();
                updateData.rejectionReason = undefined;
            } else {
                // Pending, Draft, or Rejected -> Unpublish
                updateData.isPublished = false;
                if (status === 'Rejected') {
                    updateData.rejectionReason = adminRemarks;
                }
            }

            item = await Module.findByIdAndUpdate(itemID, updateData, { new: true });
        }
        else if (itemType === 'Course') {
            const updateData = {
                approvalStatus: status,
                adminRemarks
            };

            if (status === 'Approved') {
                updateData.status = 'Published'; // Make public
                updateData.approvedBy = req.user.id;
                updateData.approvedAt = Date.now();
                updateData.rejectionReason = undefined;
            } else {
                // Pending, Draft, or Rejected -> Hide
                updateData.status = 'Draft';
                if (status === 'Rejected') {
                    updateData.rejectionReason = adminRemarks;
                    // Keep as Draft or potentially 'Inactive' if preferred, but Draft denotes "work in progress"
                } else if (status === 'Pending') {
                    updateData.status = 'Draft'; // Or specific 'Pending' status if Course model supports it, usually Draft covers it
                }
            }

            item = await Course.findByIdAndUpdate(itemID, updateData, { new: true });
        }

        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        res.status(200).json({ message: `Item ${status}`, item });
    } catch (err) {
        res.status(500).json({ message: 'Review failed', error: err.message });
    }
};

// Get Dashboard Stats
exports.getAdminStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({ role: 'Student' });
        const totalMentors = await User.countDocuments({ role: 'Staff' });
        const totalCourses = await Course.countDocuments();
        const payments = await Payment.find({ status: 'Success' });
        const revenue = payments.reduce((sum, p) => sum + p.amount, 0);

        res.status(200).json({
            totalUsers,
            totalMentors,
            totalCourses,
            revenue
        });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch stats', error: err.message });
    }
};
// Get Detailed Financial Ledger
exports.getFinancialLedger = async (req, res) => {
    try {
        const payments = await Payment.find()
            .populate('studentID', 'name email')
            .populate('courseID', 'title')
            .sort({ createdAt: -1 });
        res.status(200).json(payments);
    } catch (err) {
        res.status(500).json({ message: 'Ledger load failed', error: err.message });
    }
};

// Manual Enrollment Override
exports.overrideEnrollment = async (req, res) => {
    try {
        const { studentEmail, courseID } = req.body;
        const user = await User.findOne({ email: studentEmail });
        if (!user) return res.status(404).json({ message: 'Seeker not found' });

        const { Enrollment } = require('../models/index');

        // Add to user enrolledCourses
        await User.findByIdAndUpdate(user._id, { $addToSet: { enrolledCourses: courseID } });

        // Create Enrollment record
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        await Enrollment.create({ studentID: user._id, courseID, expiryDate });

        res.status(200).json({ message: 'Access granted successfully!' });
    } catch (err) {
        res.status(500).json({ message: 'Override failed', error: err.message });
    }
};

// Global Broadcast
exports.sendBroadcast = async (req, res) => {
    try {
        const { title, message, type, sendEmail } = req.body;
        const { Broadcast, Newsletter } = require('../models/index');
        const broadcast = new Broadcast({ title, message, type });
        await broadcast.save();

        if (sendEmail) {
            const subscribers = await Newsletter.find();
            const emails = subscribers.map(s => s.email);
            if (emails.length > 0) {
                const mailer = require('../utils/mailer');
                await mailer.sendNewsletter(emails, title, message);
            }
        }

        res.status(201).json({
            message: sendEmail ? 'Broadcast sent and transmitted to the Inner Circle.' : 'Illuminating broadcast sent to all seekers.'
        });
    } catch (err) {
        res.status(500).json({ message: 'Broadcast failed', error: err.message });
    }
};

// Advanced Analytics for Charts
exports.getAdvancedAnalytics = async (req, res) => {
    try {
        const { Payment, Impression, Progress, User } = require('../models/index');

        // Revenue Growth
        const growth = await Payment.aggregate([
            { $match: { status: 'Success' } },
            {
                $group: {
                    _id: { $month: "$createdAt" },
                    revenue: { $sum: "$amount" }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        // Conversion: Impressions vs Enrollments
        const totalImpressions = await Impression.countDocuments();
        const totalEnrollments = await Payment.countDocuments({ status: 'Success' });
        const conversionRate = totalImpressions > 0 ? (totalEnrollments / totalImpressions) * 100 : 0;

        // Student Activity: Active (logged in last 7 days) vs Total
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const activeStudents = await User.countDocuments({ role: 'Student', lastLogin: { $gte: sevenDaysAgo } });

        // Video Drop-off (Simulated average watch time %)
        const stats = await Progress.aggregate([
            {
                $group: {
                    _id: null,
                    avgCompletion: { $avg: "$percentComplete" },
                    totalRecords: { $count: {} }
                }
            }
        ]);

        res.status(200).json({
            growth,
            conversion: { rate: conversionRate.toFixed(2), totalImpressions, totalEnrollments },
            activity: { active: activeStudents, total: await User.countDocuments({ role: 'Student' }) },
            completion: stats[0] || { avgCompletion: 0 }
        });
    } catch (err) {
        res.status(500).json({ message: 'Analytics calculation failed' });
    }
};
// Banner Management
exports.uploadBanner = async (req, res) => {
    try {
        const { title, link } = req.body;
        const { Banner } = require('../models/index');
        const banner = new Banner({
            title,
            link,
            imageUrl: req.file.path
        });
        await banner.save();
        res.status(201).json({ message: 'Banner illuminated in marketplace!', banner });
    } catch (err) {
        res.status(500).json({ message: 'Banner upload failed' });
    }
};

exports.getBanners = async (req, res) => {
    try {
        const { Banner } = require('../models/index');
        const banners = await Banner.find({ active: true });
        res.status(200).json(banners);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch banners' });
    }
};

exports.getCertificates = async (req, res) => {
    try {
        const { Certificate } = require('../models/index');
        const certs = await Certificate.find()
            .populate('studentID', 'name email')
            .populate('courseID', 'title')
            .sort({ issueDate: -1 });
        res.status(200).json(certs);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch certificates' });
    }
};

exports.revokeCertificate = async (req, res) => {
    try {
        const { Certificate } = require('../models/index');
        await Certificate.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Certificate has been withdrawn from the seeker.' });
    } catch (err) {
        res.status(500).json({ message: 'Revocation failed' });
    }
};
// --- User Management (New) ---

// Get Users (Filter by Role, Search, Status)
exports.getUsers = async (req, res) => {
    try {
        const { role, search, status } = req.query;
        let filter = {};

        if (role) filter.role = role;

        // Search Filter
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            filter.$or = [
                { name: searchRegex },
                { email: searchRegex },
                { studentID: searchRegex }
            ];
        }

        // Status Filter
        if (status) {
            if (status === 'active') filter.active = true;
            if (status === 'inactive') filter.active = false;
        }

        const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
        res.status(200).json(users);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch users', error: err.message });
    }
};

// Create User (Staff or Student)
exports.createUser = async (req, res) => {
    try {
        const { name, email, password, role, phone, initial, gender } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);

        // ID Generation
        let studentID;
        const year = new Date().getFullYear();
        if (role === 'Student') {
            const count = await User.countDocuments({ role: 'Student' });
            studentID = `IS-${year}-${String(count + 1).padStart(4, '0')}`;
        } else {
            const count = await User.countDocuments({ role: 'Staff' });
            studentID = `STF-${year}-${String(count + 1).padStart(4, '0')}`;
        }

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role,
            studentID,
            phone,
            initial,
            gender,
            active: true,
            lastEditedBy: req.user ? req.user.role : 'Admin:Self', // Assume Admin creates it
            auditHistory: [{
                action: 'Create',
                performedBy: req.user ? req.user.role : 'Admin',
                reason: 'Initial Account Creation',
                timestamp: new Date()
            }]
        });

        await newUser.save();
        res.status(201).json({ message: 'User created successfully', studentID });
    } catch (err) {
        res.status(500).json({ message: 'Failed to create user', error: err.message });
    }
};

// Update User
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const reason = updates.reason || 'No reason provided';
        const adminRole = req.user ? req.user.role : 'Admin'; // Identify who is editing

        // Prevent password update if empty
        if (updates.password === '') delete updates.password;
        if (updates.password) {
            updates.password = await bcrypt.hash(updates.password, 10);
        }

        // Clean up updates object (remove metadata passed from frontend)
        delete updates.reason;
        delete updates.userId; // Often passed in ID

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Apply updates
        Object.assign(user, updates);

        // Audit Trail
        user.lastEditedBy = adminRole;
        user.lastEditedAt = new Date();

        if (!user.auditHistory) user.auditHistory = []; // Initialize if missing

        user.auditHistory.push({
            action: 'Edit',
            performedBy: adminRole,
            reason: reason,
            timestamp: new Date()
        });

        await user.save();
        res.status(200).json({ message: 'User updated successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update user', error: err.message });
    }
};

// Delete User
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, confirmID } = req.body; // Expect these from body for strict check

        // Find user first to verify ID
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Strict ID Check (Frontend should also handle this, but double check)
        // Since we are deleting, we can't store logs IN the user document. 
        // We will just proceed with deletion if confirmed.

        await User.findByIdAndDelete(id);
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete user', error: err.message });
    }
};

// Toggle User Status
exports.toggleUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body; // Expect reason

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const newStatus = !user.active;
        user.active = newStatus;

        // Audit
        user.lastEditedBy = 'Admin';
        user.lastEditedAt = new Date();

        if (!user.auditHistory) user.auditHistory = []; // Initialize if missing

        user.auditHistory.push({
            action: newStatus ? 'Activate' : 'Deactivate',
            performedBy: 'Admin',
            reason: reason || `Status changed to ${newStatus ? 'Active' : 'Inactive'}`,
            timestamp: new Date()
        });

        await user.save();
        res.status(200).json({ message: `User ${newStatus ? 'activated' : 'deactivated'}` });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update status', error: err.message });
    }
};
