const mongoose = require('mongoose');

const moduleSchema = new mongoose.Schema({
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: [true, 'Course ID is required'],
        index: true
    },
    title: {
        type: String,
        required: [true, 'Module title is required'],
        trim: true,
        minlength: [3, 'Title must be at least 3 characters'],
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    content: {
        type: String,
        default: ''
    },
    order: {
        type: Number,
        required: true,
        default: 0,
        min: [0, 'Order must be a positive number']
    },
    status: {
        type: String,
        enum: ['Draft', 'Pending', 'Approved', 'Rejected', 'Inactive'],
        default: 'Draft'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: Date,
    adminRemarks: String,
    rejectionReason: String
}, {
    timestamps: true, // Automatically handles createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
moduleSchema.index({ courseId: 1, order: 1 });
moduleSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Module', moduleSchema);
