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
            phone,
            isVerified: true // Auto-verify staff created by admin
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
        const { Module, Course, Exam, User } = require('../models/index');

        console.log('[PENDING] Fetching pending content...');

        // Get pending modules
        const pendingModules = await Module.find({ status: 'Pending' })
            .populate('courseId', 'title')
            .populate('createdBy', 'name');

        // Get pending courses
        const pendingCourses = await Course.find({ status: 'Pending' })
            .populate('createdBy', 'name')
            .populate('mentors', 'name');

        // Debug: Check all exams first
        const allExams = await Exam.find({});
        console.log('[DEBUG] Total exams in database:', allExams.length);
        if (allExams.length > 0) {
            console.log('[DEBUG] Sample exam approvalStatus values:', allExams.map(e => ({ 
                id: e._id, 
                title: e.title, 
                approvalStatus: e.approvalStatus,
                hasApprovalStatus: e.hasOwnProperty('approvalStatus')
            })));
        }

        // Get pending exams/assessments - also check for null/undefined approvalStatus
        const pendingExams = await Exam.find({ 
            $or: [
                { approvalStatus: 'Pending' },
                { approvalStatus: { $exists: false } },
                { approvalStatus: null }
            ]
        })
            .populate('courseID', 'title')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });

        // If createdBy population failed, try to get course creator as fallback

        for (let exam of pendingExams) {
            if (!exam.createdBy && exam.courseID) {
                // If no exam creator, try to use the course creator as fallback
                try {
                    const course = await Course.findById(exam.courseID._id).populate('mentors', 'name');
                    if (course && course.mentors && course.mentors.length > 0) {
                        // Use the first mentor as the fallback creator
                        exam.createdBy = {
                            name: course.mentors[0].name,
                            _id: course.mentors[0]._id
                        };
                        console.log(`[FALLBACK] Using course mentor '${course.mentors[0].name}' for exam ${exam._id}`);
                    }
                } catch (err) {
                    console.error('[COURSE LOOKUP ERROR] for exam', exam._id, ':', err.message);
                }
            }
        }

        console.log('[STATS] Found:', pendingModules.length, 'modules,', pendingCourses.length, 'courses,', pendingExams.length, 'exams');
        
        if (pendingExams.length > 0) {
            console.log('[EXAMS] Pending exams detailed info:');
            pendingExams.forEach((e, index) => {
                console.log(`[EXAM ${index + 1}]`, {
                    id: e._id,
                    title: e.title || 'NO_TITLE',
                    course: e.courseID?.title || 'NO_COURSE',
                    createdByName: e.createdBy?.name || 'NO_CREATOR_NAME',
                    hasCreatedBy: !!e.createdBy
                });
            });
        }

        // Mark courses with a type field for frontend distinction
        const coursesWithType = pendingCourses.map(course => ({
            ...course.toObject(),
            type: 'Course'
        }));

        // Combine modules and courses
        const allPendingContent = [...pendingModules, ...coursesWithType];

        const response = { content: allPendingContent, exams: pendingExams };
        console.log('[SUCCESS] Sending response to frontend');
        
        res.status(200).json(response);
    } catch (err) {
        console.error('[ERROR] getPendingContent error:', err);
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
                status: status,
                adminRemarks
            };

            if (status === 'Approved' || status === 'Published') {
                updateData.approvedBy = req.user.id;
                updateData.approvedAt = Date.now();
                updateData.rejectionReason = undefined;
            } else if (status === 'Rejected') {
                updateData.rejectionReason = adminRemarks;
            }

            item = await Module.findByIdAndUpdate(itemID, updateData, { new: true });
        }
        else if (itemType === 'Course') {
            const updateData = {
                status: status,
                adminRemarks
            };

            // Mapping for Course
            // Status can be: Draft, Approved, Published, Archived
            if (status === 'Published') {
                updateData.approvedBy = req.user.id;
                updateData.approvedAt = Date.now();
            } else if (status === 'Approved') {
                updateData.approvedBy = req.user.id;
                updateData.approvedAt = Date.now();
            } else if (status === 'Inactive') {
                updateData.status = 'Archived';
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
        const { Payment, Impression, Progress, User, Course, Enrollment, Schedule, Attendance, Module, Ticket } = require('../models/index');

        // === 1. USER & GROWTH ANALYTICS ===
        
        // Total Users Overview (KPI Cards)
        const totalStudents = await User.countDocuments({ role: 'Student' });
        const totalStaff = await User.countDocuments({ role: 'Staff' });
        const totalAdmins = await User.countDocuments({ role: 'Admin' });
        
        // Active/Inactive based on account status (active field)
        const activeUsers = await User.countDocuments({ active: true });
        const inactiveUsers = await User.countDocuments({ active: { $ne: true } });
        
        // Recently active based on login activity (last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentlyActiveUsers = await User.countDocuments({ lastLogin: { $gte: sevenDaysAgo } });
        const dormantUsers = await User.countDocuments({ 
            $or: [
                { lastLogin: { $lt: sevenDaysAgo } },
                { lastLogin: { $exists: false } }
            ]
        });

        // Student Growth Over Time (Last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const studentGrowth = await User.aggregate([
            { $match: { role: 'Student', createdAt: { $gte: thirtyDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        // Active vs Inactive Students (Based on account status)
        const activeStudents = await User.countDocuments({ role: 'Student', active: true });
        const inactiveStudents = await User.countDocuments({ role: 'Student', active: { $ne: true } });
        
        // Recently Active vs Dormant (Based on login activity)
        const recentlyActiveStudents = await User.countDocuments({ role: 'Student', lastLogin: { $gte: sevenDaysAgo } });
        const dormantStudents = totalStudents - recentlyActiveStudents;

        // === 2. COURSE PERFORMANCE ANALYTICS ===
        
        // Course Enrollment Distribution
        const courseEnrollments = await Enrollment.aggregate([
            {
                $group: {
                    _id: "$courseID",
                    enrollmentCount: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'courses',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'course'
                }
            },
            { $unwind: '$course' },
            {
                $project: {
                    courseTitle: '$course.title',
                    enrollmentCount: 1
                }
            },
            { $sort: { enrollmentCount: -1 } },
            { $limit: 10 }
        ]);

        // Course Completion Rate
        const courseCompletion = await Progress.aggregate([
            {
                $group: {
                    _id: "$courseID",
                    avgCompletion: { $avg: "$percentComplete" },
                    totalStudents: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'courses',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'course'
                }
            },
            { $unwind: '$course' },
            {
                $project: {
                    courseTitle: '$course.title',
                    completionRate: '$avgCompletion',
                    totalStudents: 1
                }
            },
            { $sort: { completionRate: -1 } }
        ]);

        // Paid vs Free Courses
        const paidCourses = await Course.countDocuments({ price: { $gt: 0 } });
        const freeCourses = await Course.countDocuments({ price: 0 });

        // === 3. REVENUE & PAYMENT ANALYTICS ===
        
        // Revenue Growth (Monthly)
        const revenueGrowth = await Payment.aggregate([
            { $match: { status: 'Success' } },
            {
                $group: {
                    _id: { 
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" }
                    },
                    revenue: { $sum: "$amount" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);

        // Total Revenue
        const totalRevenue = await Payment.aggregate([
            { $match: { status: 'Success' } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        // Revenue by Course
        const revenueByCourse = await Payment.aggregate([
            { $match: { status: 'Success' } },
            {
                $group: {
                    _id: "$courseID",
                    revenue: { $sum: "$amount" },
                    enrollments: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'courses',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'course'
                }
            },
            { $unwind: '$course' },
            {
                $project: {
                    courseTitle: '$course.title',
                    revenue: 1,
                    enrollments: 1
                }
            },
            { $sort: { revenue: -1 } },
            { $limit: 10 }
        ]);

        // Payment Success vs Failure
        const successPayments = await Payment.countDocuments({ status: 'Success' });
        const failedPayments = await Payment.countDocuments({ status: { $in: ['Failed', 'Pending'] } });

        // === 4. CONTENT & STAFF ANALYTICS ===
        
        // Content Status Distribution (Modules + Courses + Exams)
        const { Exam } = require('../models/index');
        
        // Count pending content from all sources
        const pendingModules = await Module.countDocuments({ status: 'Pending' });
        const pendingCourses = await Course.countDocuments({ status: 'Pending' });
        const pendingExams = await Exam.countDocuments({ 
            $or: [
                { approvalStatus: 'Pending' },
                { approvalStatus: { $exists: false } },
                { approvalStatus: null }
            ]
        });
        const pendingContent = pendingModules + pendingCourses + pendingExams;
        
        // Count approved content from all sources
        const approvedModules = await Module.countDocuments({ status: { $in: ['Approved', 'Published'] } });
        const approvedCourses = await Course.countDocuments({ status: { $in: ['Approved', 'Published'] } });
        const approvedExams = await Exam.countDocuments({ approvalStatus: 'Approved' });
        const approvedContent = approvedModules + approvedCourses + approvedExams;
        
        // Count rejected content from all sources
        const rejectedModules = await Module.countDocuments({ status: 'Rejected' });
        const rejectedCourses = await Course.countDocuments({ status: 'Rejected' });
        const rejectedExams = await Exam.countDocuments({ approvalStatus: 'Rejected' });
        const rejectedContent = rejectedModules + rejectedCourses + rejectedExams;

        // Staff Content Contribution
        const staffContributions = await Module.aggregate([
            {
                $group: {
                    _id: "$createdBy",
                    contentCount: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'staff'
                }
            },
            { $unwind: '$staff' },
            {
                $project: {
                    staffName: '$staff.name',
                    contentCount: 1
                }
            },
            { $sort: { contentCount: -1 } }
        ]);

        // Live Classes by Staff
        const liveClassesByStaff = await Schedule.aggregate([
            {
                $group: {
                    _id: "$staffID",
                    classCount: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'staff'
                }
            },
            { $unwind: '$staff' },
            {
                $project: {
                    staffName: '$staff.name',
                    classCount: 1
                }
            },
            { $sort: { classCount: -1 } }
        ]);

        // === 5. LIVE CLASS & ATTENDANCE ANALYTICS ===
        
        // Live Class Attendance Rate (Last 30 days)
        const attendanceRate = await Attendance.aggregate([
            { $match: { timestamp: { $gte: thirtyDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                    present: {
                        $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] }
                    },
                    total: { $sum: 1 }
                }
            },
            {
                $project: {
                    date: "$_id",
                    attendanceRate: { 
                        $multiply: [{ $divide: ["$present", "$total"] }, 100] 
                    }
                }
            },
            { $sort: { "date": 1 } }
        ]);

        // === 6. STUDENT ENGAGEMENT ANALYTICS ===
        
        // Video Completion Rate
        const videoCompletion = await Progress.aggregate([
            {
                $bucket: {
                    groupBy: "$percentComplete",
                    boundaries: [0, 25, 50, 75, 100],
                    default: "Other",
                    output: {
                        count: { $sum: 1 }
                    }
                }
            }
        ]);

        // Average Time Spent per Student (based on progress records)
        const avgTimeSpent = await Progress.aggregate([
            {
                $group: {
                    _id: "$studentID",
                    avgProgress: { $avg: "$percentComplete" },
                    totalRecords: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: null,
                    overallAvg: { $avg: "$avgProgress" }
                }
            }
        ]);

        // === 7. SUPPORT & FEEDBACK ANALYTICS ===
        
        // Support Requests Over Time
        const supportRequests = await Ticket.aggregate([
            { $match: { createdAt: { $gte: thirtyDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        // Ticket Status Distribution
        const openTickets = await Ticket.countDocuments({ status: 'Open' });
        const resolvedTickets = await Ticket.countDocuments({ status: 'Resolved' });
        const closedTickets = await Ticket.countDocuments({ status: 'Closed' });

        // === 8. SYSTEM HEALTH & SECURITY ===
        
        // Login Activity Trend (Last 30 days)
        const loginActivity = await User.aggregate([
            { $match: { lastLogin: { $gte: thirtyDaysAgo, $exists: true } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$lastLogin" } },
                    logins: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        // Role-Based Usage
        const roleDistribution = {
            students: totalStudents,
            staff: totalStaff,
            admins: totalAdmins
        };

        // === RESPONSE ===
        res.status(200).json({
            // User & Growth
            userOverview: {
                totalStudents,
                totalStaff,
                totalAdmins,
                activeUsers,
                inactiveUsers,
                recentlyActiveUsers,
                dormantUsers
            },
            studentGrowth,
            activeVsInactive: { active: activeStudents, inactive: inactiveStudents },
            recentlyActiveVsDormant: { recentlyActive: recentlyActiveStudents, dormant: dormantStudents },
            
            // Course Performance
            courseEnrollments,
            courseCompletion,
            paidVsFree: { paid: paidCourses, free: freeCourses },
            
            // Revenue & Payment
            revenueGrowth,
            totalRevenue: totalRevenue[0]?.total || 0,
            revenueByCourse,
            paymentStatus: { success: successPayments, failed: failedPayments },
            
            // Content & Staff
            contentStatus: { pending: pendingContent, approved: approvedContent, rejected: rejectedContent },
            staffContributions,
            liveClassesByStaff,
            
            // Live Class & Attendance
            attendanceRate,
            
            // Student Engagement
            videoCompletion,
            avgEngagement: avgTimeSpent[0]?.overallAvg || 0,
            
            // Support
            supportRequests,
            ticketStatus: { open: openTickets, resolved: resolvedTickets, closed: closedTickets },
            
            // System Health
            loginActivity,
            roleDistribution
        });
    } catch (err) {
        console.error('Analytics error:', err);
        res.status(500).json({ message: 'Analytics calculation failed', error: err.message });
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
            imageUrl: `/uploads/content/${req.file.filename}` // Server-relative path
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
        } else if (role === 'Staff') {
            const count = await User.countDocuments({ role: 'Staff' });
            studentID = `STF-${year}-${String(count + 1).padStart(4, '0')}`;
        } else if (role === 'Admin') {
            const count = await User.countDocuments({ role: 'Admin' });
            studentID = `ADM-${year}-${String(count + 1).padStart(4, '0')}`;
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
            isVerified: true, // Auto-verify users created by admin
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

        // Prevent deletion of default admin
        if (user.role === 'Admin' && user.isDefaultAdmin) {
            return res.status(403).json({ 
                message: 'Cannot delete default admin. Please set another admin as default first.',
                isDefaultAdmin: true
            });
        }

        // Only default admin can delete other admins
        if (user.role === 'Admin') {
            if (!req.user.isDefaultAdmin) {
                return res.status(403).json({ 
                    message: 'Only the default admin can delete other admins.',
                    requiresDefaultAdmin: true
                });
            }
        }

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

        // Prevent disabling default admin
        if (user.role === 'Admin' && user.isDefaultAdmin && user.active) {
            return res.status(403).json({ 
                message: 'Cannot disable the default admin. Please set another admin as default first.',
                isDefaultAdmin: true
            });
        }

        // Prevent admin from disabling themselves
        if (req.user.id === id && user.active) {
            return res.status(403).json({ 
                message: 'You cannot disable your own account.',
                isSelf: true
            });
        }

        // Only default admin can disable other admins
        if (user.role === 'Admin' && user.active) {
            if (!req.user.isDefaultAdmin) {
                return res.status(403).json({ 
                    message: 'Only the default admin can disable other admins.',
                    requiresDefaultAdmin: true
                });
            }
        }

        const wasActive = user.active; // Track previous status
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
        res.status(200).json({ 
            message: `User ${newStatus ? 'activated' : 'deactivated'}`,
            wasActive: wasActive, // Previous status
            newActive: newStatus  // New status
        });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update status', error: err.message });
    }
};

// Set Default Admin
exports.setDefaultAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Only current default admin can change default status
        if (!req.user.isDefaultAdmin) {
            return res.status(403).json({ 
                message: 'Only the current default admin can transfer default admin privileges.',
                requiresDefaultAdmin: true
            });
        }
        
        // Find the target admin
        const targetAdmin = await User.findById(id);
        if (!targetAdmin) return res.status(404).json({ message: 'Admin not found' });
        
        // Verify it's an admin
        if (targetAdmin.role !== 'Admin') {
            return res.status(400).json({ message: 'User must be an Admin to be set as default' });
        }
        
        // Remove default status from all other admins
        await User.updateMany(
            { role: 'Admin', isDefaultAdmin: true },
            { $set: { isDefaultAdmin: false } }
        );
        
        // Set this admin as default
        targetAdmin.isDefaultAdmin = true;
        await targetAdmin.save();
        
        res.status(200).json({ 
            message: 'Default admin updated successfully',
            defaultAdmin: {
                id: targetAdmin._id,
                name: targetAdmin.name,
                email: targetAdmin.email
            }
        });
    } catch (err) {
        res.status(500).json({ message: 'Failed to set default admin', error: err.message });
    }
};
