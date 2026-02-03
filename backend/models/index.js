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
    profilePic: { type: String },
    active: { type: Boolean, default: true },

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
    price: { type: Number, required: true },
    mentorID: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    thumbnail: { type: String },
    status: { type: String, enum: ['Draft', 'Published', 'Inactive'], default: 'Draft' },
    totalLessons: { type: Number, default: 0 },
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

// 6. Content Collection
const contentSchema = new Schema({
    courseID: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['Video', 'PDF', 'Note'], required: true },
    fileUrl: { type: String, required: true },
    previewDuration: { type: Number, default: 0 }, // Seconds
    approvalStatus: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    adminRemarks: { type: String },
    createdAt: { type: Date, default: Date.now }
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
    questions: [{
        questionText: { type: String, required: true },
        options: [{ type: String, required: true }],
        correctOptionIndex: { type: Number, required: true }
    }],
    passingScore: { type: Number, default: 70 },
    activationThreshold: { type: Number, default: 85 }, // % progress required
    status: { type: String, enum: ['Draft', 'Published'], default: 'Draft' }
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
    completedLessons: [{ type: Schema.Types.ObjectId, ref: 'Content' }],
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

module.exports = {
    User: mongoose.model('User', userSchema),
    Course: mongoose.model('Course', courseSchema),
    Schedule: mongoose.model('Schedule', scheduleSchema),
    Attendance: mongoose.model('Attendance', attendanceSchema),
    Payment: mongoose.model('Payment', paymentSchema),
    Content: mongoose.model('Content', contentSchema),
    FAQ: mongoose.model('FAQ', faqSchema),
    Exam: mongoose.model('Exam', examSchema),
    Certificate: mongoose.model('Certificate', certificateSchema),
    Impression: mongoose.model('Impression', impressionSchema),
    Progress: mongoose.model('Progress', progressSchema),
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
        status: { type: String, enum: ['Active', 'Expired'], default: 'Active' }
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
    }))
};
