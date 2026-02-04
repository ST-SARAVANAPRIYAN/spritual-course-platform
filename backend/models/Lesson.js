const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
    moduleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Module',
        required: [true, 'Module ID is required'],
        index: true
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: [true, 'Course ID is required']
    },
    title: {
        type: String,
        required: [true, 'Lesson title is required'],
        trim: true,
        minlength: [3, 'Title must be at least 3 characters'],
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    // EditorJS content stored as JSON
    content: {
        type: Object,
        required: [true, 'Lesson content is required'],
        default: {
            time: Date.now(),
            blocks: [],
            version: '2.29.0'
        },
        validate: {
            validator: function (v) {
                // Validate EditorJS structure
                return v &&
                    typeof v === 'object' &&
                    Array.isArray(v.blocks);
            },
            message: 'Content must be valid EditorJS format with blocks array'
        }
    },
    order: {
        type: Number,
        required: true,
        default: 0,
        min: [0, 'Order must be a positive number']
    },
    duration: {
        type: Number, // Duration in minutes
        default: 0,
        min: [0, 'Duration must be a positive number']
    },
    // Additional resources (PDFs, files, etc.)
    resources: [{
        type: {
            type: String,
            enum: ['pdf', 'video', 'audio', 'document', 'other'],
            required: true
        },
        url: {
            type: String,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        size: Number, // in bytes
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    // Video-specific fields
    videoUrl: String, // Direct video URL (Cloudinary or YouTube)
    videoType: {
        type: String,
        enum: ['upload', 'youtube', 'vimeo', null],
        default: null
    },
    videoDuration: Number, // in seconds
    thumbnail: String, // Video thumbnail URL

    // Approval workflow
    approvalStatus: {
        type: String,
        enum: ['Draft', 'Pending', 'Approved', 'Rejected'],
        default: 'Draft'
    },
    adminRemarks: String,
    rejectionReason: String,

    // Publishing
    isPublished: {
        type: Boolean,
        default: false
    },
    publishedAt: Date,

    // Preview for non-enrolled users
    isFreePreview: {
        type: Boolean,
        default: false
    },
    previewDuration: {
        type: Number, // seconds
        default: 0
    },

    // User tracking
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

    // Version control (optional)
    version: {
        type: Number,
        default: 1
    },
    previousVersions: [{
        content: Object,
        savedAt: Date,
        savedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],

    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for performance
lessonSchema.index({ moduleId: 1, order: 1 });
lessonSchema.index({ courseId: 1 });
lessonSchema.index({ createdBy: 1 });
lessonSchema.index({ approvalStatus: 1 });
lessonSchema.index({ isPublished: 1 });

// Update timestamp on save
lessonSchema.pre('save', function (next) {
    this.updatedAt = Date.now();

    // Auto-publish if approved
    if (this.approvalStatus === 'Approved' && !this.isPublished) {
        this.isPublished = true;
        this.publishedAt = Date.now();
    }

    next();
});

// Virtual for resource count
lessonSchema.virtual('resourceCount').get(function () {
    return this.resources ? this.resources.length : 0;
});

// Virtual for content block count
lessonSchema.virtual('blockCount').get(function () {
    return this.content && this.content.blocks ? this.content.blocks.length : 0;
});

// Method to create a new version before updating
lessonSchema.methods.saveVersion = function () {
    if (this.content && this.content.blocks && this.content.blocks.length > 0) {
        this.previousVersions.push({
            content: JSON.parse(JSON.stringify(this.content)),
            savedAt: Date.now(),
            savedBy: this.createdBy
        });

        // Keep only last 10 versions
        if (this.previousVersions.length > 10) {
            this.previousVersions = this.previousVersions.slice(-10);
        }

        this.version += 1;
    }
};

// Ensure virtuals are included in JSON
lessonSchema.set('toJSON', { virtuals: true });
lessonSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Lesson', lessonSchema);
