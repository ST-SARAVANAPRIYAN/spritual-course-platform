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
    name: { type: String, required: true }, // Enforce Caps in frontend
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String },
    profilePic: { type: String },
    active: { type: Boolean, default: true },
    isDefaultAdmin: { type: Boolean, default: false }, // Only one admin can be default

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

// 10. Progress Tracking
const progressSchema = new Schema({
    studentID: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    courseID: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    completedLessons: [{ type: Schema.Types.ObjectId, ref: 'Content' }],
    percentComplete: { type: Number, default: 0 },
    lastAccessed: { type: Date, default: Date.now }
});

// 11. Marketing Analytics / Impressions
const impressionSchema = new Schema({
    courseID: { type: Schema.Types.ObjectId, ref: 'Course' },
    studentID: { type: Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['View', 'Click', 'VideoSkip'], default: 'View' },
    metadata: { type: String }, // e.g., "From Search", "Direct"
    timestamp: { type: Date, default: Date.now }
});

// 12. Results Collection
const resultSchema = new Schema({
    studentID: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    examID: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
    score: { type: Number, required: true },
    status: { type: String, enum: ['Pass', 'Fail'], required: true },
    date: { type: Date, default: Date.now }
});

// 13. Enrollments Collection
const enrollmentSchema = new Schema({
    studentID: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    courseID: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    enrolledAt: { type: Date, default: Date.now },
    expiryDate: { type: Date },
    status: { type: String, enum: ['Active', 'Expired'], default: 'Active' }
});

// 14. Support Tickets Collection
const ticketSchema = new Schema({
    studentID: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    response: { type: String },
    status: { type: String, enum: ['Open', 'Resolved'], default: 'Open' },
    createdAt: { type: Date, default: Date.now }
});

// 15. Forum/Comments Collection
const forumSchema = new Schema({
    courseID: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    studentID: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    comment: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

// 16. Broadcasts Collection
const broadcastSchema = new Schema({
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['Announcement', 'Promotion', 'Emergency'], default: 'Announcement' },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

// 17. Banners Collection
const bannerSchema = new Schema({
    title: { type: String, required: true },
    imageUrl: { type: String, required: true },
    link: { type: String },
    active: { type: Boolean, default: true }
});

// 18. Blogs Collection
const blogSchema = new Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    author: { type: String, default: 'InnerSpark' },
    thumbnail: { type: String },
    category: { type: String },
    date: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
});

// 19. Events Collection
const eventSchema = new Schema({
    title: { type: String, required: true },
    date: { type: Date, required: true },
    time: { type: String },
    speaker: { type: String },
    location: { type: String },
    description: { type: String },
    registrationLink: { type: String },
    active: { type: Boolean, default: true }
});

// 20. Newsletter Subscriptions Collection
const newsletterSchema = new Schema({
    email: { type: String, required: true, unique: true },
    joinedAt: { type: Date, default: Date.now }
});

// 21. Coupons Collection
const couponSchema = new Schema({
    code: { type: String, required: true, unique: true },
    discountPercent: { type: Number, required: true }, // e.g., 10 for 10%
    expiryDate: { type: Date },
    active: { type: Boolean, default: true }
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
    Progress: mongoose.model('Progress', progressSchema),
    Impression: mongoose.model('Impression', impressionSchema),
    Result: mongoose.model('Result', resultSchema),
    Enrollment: mongoose.model('Enrollment', enrollmentSchema),
    Ticket: mongoose.model('Ticket', ticketSchema),
    Forum: mongoose.model('Forum', forumSchema),
    Broadcast: mongoose.model('Broadcast', broadcastSchema),
    Banner: mongoose.model('Banner', bannerSchema),
    Blog: mongoose.model('Blog', blogSchema),
    Event: mongoose.model('Event', eventSchema),
    Newsletter: mongoose.model('Newsletter', newsletterSchema),
    Coupon: mongoose.model('Coupon', couponSchema)
};
