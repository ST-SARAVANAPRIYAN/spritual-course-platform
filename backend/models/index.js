/**
 * InnerSpark Database Schemas (Mongoose)
 * Version: 1.0
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// 1. Users Collection
const userSchema = new Schema({
    studentID: { type: String, unique: true, sparse: true }, // IS-YYYY-XXXX
    role: { type: String, enum: ['Student', 'Staff', 'Admin'], required: true },
    name: { type: String, required: true }, // Encforce Caps in frontend
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String },
    additionalPhone: { type: String }, // Additional contact number
    profilePic: { type: String },
    active: { type: Boolean, default: true },
    isDefaultAdmin: { type: Boolean, default: false }, // Only one admin can be default

    // Verification & Security
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    lastLogin: { type: Date }, // Track last login

    // OTP for registration
    registrationOTP: { type: String },
    registrationOTPExpires: { type: Date },
    registrationOTPAttempts: { type: Number, default: 0 },

    // Extended Profile
    initial: { type: String },
    fatherName: { type: String },
    motherName: { type: String },
    dob: { type: Date }, // Frontend calculates age
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    maritalStatus: { type: String, enum: ['Single', 'Married'] },
    spouseName: { type: String },
    spouseContact: { type: String },
    whatsappNumber: { type: String },

    address: {
        doorNumber: { type: String },
        streetName: { type: String },
        town: { type: String },
        district: { type: String },
        pincode: { type: String },
        state: { type: String, default: 'Tamil Nadu' }
    },

    workDetails: {
        type: { type: String, enum: ['Salaried', 'Business', 'Daily Wages', 'Unemployed', 'Student'] },
        name: { type: String }, // Company/Business name
        description: { type: String }
    },

    bankDetails: {
        accountHolderName: { type: String },
        accountNumber: { type: String },
        bankName: { type: String },
        ifscCode: { type: String },
        branchName: { type: String }
    },

    enrolledCourses: [{ type: Schema.Types.ObjectId, ref: 'Course' }],

    // Audit Trail
    lastEditedBy: { type: String, default: 'System' },
    lastEditedAt: { type: Date, default: Date.now },
    auditHistory: [{
        action: { type: String, enum: ['Create', 'Edit', 'Deactivate', 'Activate', 'Delete-Attempt'], required: true },
        performedBy: { type: String, required: true },
        reason: { type: String, required: true }, // Mandatory 100 chars
        timestamp: { type: Date, default: Date.now }
    }],

    createdAt: { type: Date, default: Date.now }
});

// 2. Courses Collection
const courseSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true }, // Meditation/Motivation/etc.
    price: { type: Number, required: true }, // In Rupees
    difficulty: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], required: true },
    duration: { type: String, required: true }, // e.g., "10 Hours"
    mentors: [{ type: Schema.Types.ObjectId, ref: 'User' }], // Multiple, Optional for Draft
    thumbnail: { type: String },
    introVideoUrl: { type: String }, // Introduction Video URL
    introText: { type: String }, // Rich text description
    previewDuration: { type: Number, default: 60 }, // Seconds
    status: {
        type: String,
        enum: ['Draft', 'Pending', 'Approved', 'Published', 'Inactive'],
        default: 'Draft'
    },
    // Draft: Initial creation
    // Pending: Submitted for approval
    // Approved: Approved by Admin (Upcoming)
    // Published: Live (Current)
    // Inactive: Soft deleted/Hidden

    totalLessons: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

// 3. Schedules Collection
const scheduleSchema = new Schema({
    courseID: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    staffID: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    meetingLink: { type: String },
    type: { type: String, enum: ['Live', 'Recorded Release'], required: true }
});

// 4. Attendance Collection
const attendanceSchema = new Schema({
    studentID: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    courseID: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    scheduleID: { type: Schema.Types.ObjectId, ref: 'Schedule', required: true },
    status: { type: String, enum: ['Present', 'Absent'], required: true },
    timestamp: { type: Date, default: Date.now }
});

// 5. Payments Collection
const paymentSchema = new Schema({
    transactionID: { type: String, unique: true },
    studentID: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    courseID: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['UPI', 'Card', 'Manual'], required: true },
    status: { type: String, enum: ['Pending', 'Success', 'Failed'], default: 'Pending' },
    date: { type: Date, default: Date.now }
});



// 7. Chatbot/FAQ Collection
const faqSchema = new Schema({
    question: { type: String, required: true }, // Keywords/Tags
    answer: { type: String, required: true },
    category: { type: String, enum: ['Technical', 'Spiritual', 'Payment'], required: true },
    adminRemarks: { type: String }
});

// 8. Exams Collection
const examSchema = new Schema({
    courseID: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true },
    duration: { type: Number, default: 30 }, // Duration in minutes
    questions: [{
        questionText: { type: String, required: true },
        options: [{ type: String, required: true }],
        correctOptionIndices: [{ type: Number, required: true }] // Support multiple correct answers
    }],
    passingScore: { type: Number, default: 70 },
    activationThreshold: { type: Number, default: 85 }, // % progress required
    status: { type: String, enum: ['Draft', 'Published'], default: 'Draft' },
    approvalStatus: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectionReason: { type: String }
});

// 9. Certificates/Results Collection
const certificateSchema = new Schema({
    studentID: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    courseID: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    examScore: { type: Number, required: true },
    issueDate: { type: Date, default: Date.now },
    certificateURL: { type: String },
    uniqueCertID: { type: String, unique: true } // CERT-<courseID>-12345
});

// 11. Progress Tracking
const progressSchema = new Schema({
    studentID: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    courseID: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    completedModules: [{ type: Schema.Types.ObjectId, ref: 'Module' }],
    percentComplete: { type: Number, default: 0 },
    lastAccessed: { type: Date, default: Date.now }
});

// 12. Marketing Analytics
const impressionSchema = new Schema({
    courseID: { type: Schema.Types.ObjectId, ref: 'Course' },
    studentID: { type: Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['View', 'Click', 'VideoSkip'], default: 'View' },
    metadata: { type: String }, // e.g., "From Search", "Direct"
    timestamp: { type: Date, default: Date.now }
});

// 12. System Settings (Singleton Document)
// 12. System Settings (Moved to independent file Settings.js)

// Import new modular content models
const Module = require('./Module');

module.exports = {
    User: mongoose.model('User', userSchema),
    Course: mongoose.model('Course', courseSchema),
    Schedule: mongoose.model('Schedule', scheduleSchema),
    Attendance: mongoose.model('Attendance', attendanceSchema),
    Payment: mongoose.model('Payment', paymentSchema),
    Impression: mongoose.model('Impression', impressionSchema),
    Progress: mongoose.model('Progress', progressSchema),
    Exam: mongoose.model('Exam', examSchema), // Add Exam model
    Certificate: mongoose.model('Certificate', certificateSchema), // Add Certificate model
    Module, // New modular content system
    Result: mongoose.model('Result', new Schema({
        studentID: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        examID: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
        score: { type: Number, required: true },
        status: { type: String, enum: ['Pass', 'Fail'], required: true },
        date: { type: Date, default: Date.now }
    })),
    Enrollment: mongoose.model('Enrollment', new Schema({
        studentID: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        courseID: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
        enrolledAt: { type: Date, default: Date.now },
        expiryDate: { type: Date },
        status: { type: String, enum: ['Active', 'Expired'], default: 'Active' },
        progress: { type: Number, default: 0, min: 0, max: 100 },
        completed: { type: Boolean, default: false }
    })),
    Ticket: mongoose.model('Ticket', new Schema({
        studentID: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        subject: { type: String, required: true },
        message: { type: String, required: true },
        status: { type: String, enum: ['Open', 'Resolved'], default: 'Open' },
        createdAt: { type: Date, default: Date.now }
    })),
    Forum: mongoose.model('Forum', new Schema({
        courseID: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
        studentID: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        comment: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }
    })),
    Broadcast: mongoose.model('Broadcast', new Schema({
        title: { type: String, required: true },
        message: { type: String, required: true },
        type: { type: String, enum: ['Announcement', 'Promotion', 'Emergency'], default: 'Announcement' },
        active: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now }
    })),
    Banner: mongoose.model('Banner', new Schema({
        title: { type: String, required: true },
        imageUrl: { type: String, required: true },
        link: { type: String },
        active: { type: Boolean, default: true }
    })),
    Blog: mongoose.model('Blog', new Schema({
        title: { type: String, required: true },
        content: { type: String, required: true },
        author: { type: String, default: 'InnerSpark' },
        thumbnail: { type: String },
        category: { type: String },
        createdAt: { type: Date, default: Date.now }
    })),
    Event: mongoose.model('Event', new Schema({
        title: { type: String, required: true },
        date: { type: Date, required: true },
        location: { type: String },
        description: { type: String },
        registrationLink: { type: String },
        active: { type: Boolean, default: true }
    })),
    Newsletter: mongoose.model('Newsletter', new Schema({
        email: { type: String, required: true, unique: true },
        joinedAt: { type: Date, default: Date.now }
    })),
    Coupon: mongoose.model('Coupon', new Schema({
        code: { type: String, required: true, unique: true },
        discountPercent: { type: Number, required: true }, // e.g., 10 for 10%
        expiryDate: { type: Date },
        active: { type: Boolean, default: true }
    })),
    // Ticket System - defined AFTER User model to ensure populate works
    Ticket: (() => {
        // Delete any existing compiled Ticket model to prevent schema conflicts
        if (mongoose.models.Ticket) {
            delete mongoose.models.Ticket;
        }
        if (mongoose.connection.models.Ticket) {
            delete mongoose.connection.models.Ticket;
        }

        const ticketReplySchema = new Schema({
            message: { type: String, required: true },
            repliedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
            repliedAt: { type: Date, default: Date.now },
            isAdminReply: { type: Boolean, default: false }
        });

        const ticketSchema = new Schema({
            ticketID: { type: String, unique: true }, // Auto-generated, not required
            subject: {
                type: String,
                required: true,
                enum: [
                    'Technical Issue', 'Course Access Problem', 'Payment Issue',
                    'Account Related', 'Content Quality', 'Certificate Issue',
                    'General Inquiry', 'Feature Request', 'Bug Report', 'Other'
                ]
            },
            description: { type: String, required: true },
            createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
            status: { type: String, enum: ['Open', 'In Progress', 'Resolved', 'Closed'], default: 'Open' },
            priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
            replies: [ticketReplySchema],
            lastUpdated: { type: Date, default: Date.now },
            isReadByAdmin: { type: Boolean, default: false },
            isReadByUser: { type: Boolean, default: true }
        }, { timestamps: true });

        // Generate unique ticket ID before saving
        ticketSchema.pre('save', async function () {
            if (!this.ticketID) {
                const year = new Date().getFullYear();
                const month = String(new Date().getMonth() + 1).padStart(2, '0');
                const lastTicket = await this.constructor.findOne({
                    ticketID: new RegExp(`^TKT-${year}${month}`)
                }).sort({ ticketID: -1 });
                let nextNumber = 1;
                if (lastTicket) {
                    const lastNumber = parseInt(lastTicket.ticketID.split('-')[2]);
                    nextNumber = lastNumber + 1;
                }
                this.ticketID = `TKT-${year}${month}-${String(nextNumber).padStart(4, '0')}`;
            }
        });

        return mongoose.model('Ticket', ticketSchema);
    })(),

    // 12. Contact Messages Collection
    ContactMessage: (() => {
        const contactMessageSchema = new Schema({
            name: { type: String, required: true },
            email: { type: String, required: true },
            subject: { type: String, required: true },
            message: { type: String, required: true },
            status: {
                type: String,
                enum: ['New', 'Read', 'Replied', 'Archived'],
                default: 'New'
            },
            priority: {
                type: String,
                enum: ['Low', 'Medium', 'High', 'Urgent'],
                default: 'Medium'
            },
            source: { type: String, default: 'Website' }, // Website, Landing Page, etc.
            ipAddress: { type: String },
            userAgent: { type: String },
            adminNotes: { type: String }, // Admin can add notes
            repliedAt: { type: Date },
            repliedBy: { type: Schema.Types.ObjectId, ref: 'User' }
        }, { timestamps: true });

        return mongoose.model('ContactMessage', contactMessageSchema);
    })(),

    // 13. Course Subscribers Collection
    CourseSubscriber: (() => {
        const courseSubscriberSchema = new Schema({
            courseID: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
            name: { type: String, required: true },
            email: { type: String, required: true },
            phone: { type: String, required: true },
            notified: { type: Boolean, default: false }, // Whether they've been notified
            notifiedAt: { type: Date }
        }, { timestamps: true });

        // Compound index to prevent duplicate subscriptions
        courseSubscriberSchema.index({ courseID: 1, email: 1 }, { unique: true });

        return mongoose.model('CourseSubscriber', courseSubscriberSchema);
    })(),

    // 14. Gallery Collection
    Gallery: (() => {
        const gallerySchema = new Schema({
            imageUrl: { type: String, required: true },
            description: { 
                type: String, 
                required: true,
                minlength: 10,
                maxlength: 100,
                trim: true
            },
            likes: { type: Number, default: 0, min: 0 },
            likedBy: [{ type: String }], // Store IP addresses or session IDs
            uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
            fileSize: { type: Number }, // in bytes
            fileName: { type: String },
            displayOrder: { type: Number, default: 0 }, // Order for display
            active: { type: Boolean, default: true }
        }, { timestamps: true });

        gallerySchema.index({ active: 1, displayOrder: 1 });

        return mongoose.model('Gallery', gallerySchema);
    })()
};
