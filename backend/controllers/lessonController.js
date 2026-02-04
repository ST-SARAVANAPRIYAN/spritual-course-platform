const { Lesson, Module, Course } = require('../models/index');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { upload } = require('./uploadController'); // Optional if needed, but usually controller creates URL from req.file

/**
 * Lesson Controller
 * Handles CRUD operations for lessons with EditorJS content
 */

// Create new lesson
exports.createLesson = catchAsync(async (req, res, next) => {
    console.log('📝 Creating new lesson...');
    console.log('User:', req.user);
    console.log('Body:', req.body);

    const { moduleId, title, description, content, duration, isFreePreview, previewDuration } = req.body;

    // Validation
    if (!moduleId || !title) {
        console.error('❌ Missing required fields');
        return next(new AppError('Module ID and title are required', 400));
    }

    // Verify module exists
    const module = await Module.findById(moduleId).populate('courseId');
    if (!module) {
        console.error('❌ Module not found:', moduleId);
        return next(new AppError('Module not found', 404));
    }

    // Check authorization
    const isAdmin = req.user.role === 'Admin';
    const course = await Course.findById(module.courseId);
    const isMentor = course.mentors?.some(m => m.toString() === req.user.id);

    if (!isAdmin && !isMentor) {
        console.error('❌ Unauthorized: User not admin or course mentor');
        return next(new AppError('Only course mentors or admins can create lessons', 403));
    }

    // Parse content if it's a string
    let parsedContent;
    try {
        parsedContent = typeof content === 'string' ? JSON.parse(content) : content;
    } catch (err) {
        return next(new AppError('Invalid content format. Must be valid EditorJS JSON', 400));
    }

    // Validate EditorJS content structure
    if (!parsedContent || !Array.isArray(parsedContent.blocks)) {
        return next(new AppError('Content must have a valid blocks array', 400));
    }

    // Get current max order for this module
    const maxOrderLesson = await Lesson.findOne({ moduleId })
        .sort({ order: -1 })
        .select('order');
    const nextOrder = maxOrderLesson ? maxOrderLesson.order + 1 : 0;

    // Create lesson
    const lesson = new Lesson({
        moduleId,
        courseId: module.courseId,
        title,
        description,
        content: parsedContent,
        order: nextOrder,
        duration: duration || 0,
        isFreePreview: isFreePreview || false,
        previewDuration: previewDuration || 0,
        createdBy: req.user.id,
        approvalStatus: isAdmin ? 'Approved' : 'Draft'
    });

    await lesson.save();
    console.log('✅ Lesson created successfully:', lesson._id);

    // Add lesson to module
    module.lessons.push(lesson._id);
    await module.save();

    // Update course total lessons
    await Course.findByIdAndUpdate(module.courseId, {
        $inc: { totalLessons: 1 }
    });

    res.status(201).json({
        message: 'Lesson created successfully',
        lesson
    });
});

// Get single lesson
exports.getLesson = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { includeContent } = req.query;

    console.log('📝 Fetching lesson:', id);

    const selectFields = includeContent === 'true'
        ? '' // Include all fields
        : '-content -previousVersions'; // Exclude large fields

    const lesson = await Lesson.findById(id)
        .select(selectFields)
        .populate('createdBy', 'name email')
        .populate('approvedBy', 'name')
        .populate('moduleId', 'title')
        .populate('courseId', 'title');

    if (!lesson) {
        console.error('❌ Lesson not found');
        return next(new AppError('Lesson not found', 404));
    }

    // Authorization check for unpublished content
    const isStaffOrAdmin = req.user && ['Staff', 'Admin'].includes(req.user.role);
    if (!lesson.isPublished && !isStaffOrAdmin) {
        return next(new AppError('This lesson is not yet published', 403));
    }

    console.log('✅ Lesson fetched successfully');

    res.status(200).json({ lesson });
});

// Update lesson
exports.updateLesson = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { title, description, content, duration, isFreePreview, previewDuration, videoUrl, videoType } = req.body;

    console.log('📝 Updating lesson:', id);

    const lesson = await Lesson.findById(id);
    if (!lesson) {
        return next(new AppError('Lesson not found', 404));
    }

    // Authorization check
    const isAdmin = req.user.role === 'Admin';
    const isCreator = lesson.createdBy.toString() === req.user.id;

    if (!isAdmin && !isCreator) {
        return next(new AppError('You can only edit lessons you created', 403));
    }

    // Can't edit approved lessons unless admin
    if (lesson.approvalStatus === 'Approved' && !isAdmin) {
        return next(new AppError('Cannot edit approved lessons. Please create a new version.', 403));
    }

    // Save version before updating content
    if (content && lesson.content) {
        lesson.saveVersion();
    }

    // Update fields
    if (title) lesson.title = title;
    if (description !== undefined) lesson.description = description;
    if (duration !== undefined) lesson.duration = duration;
    if (isFreePreview !== undefined) lesson.isFreePreview = isFreePreview;
    if (previewDuration !== undefined) lesson.previewDuration = previewDuration;
    if (videoUrl !== undefined) lesson.videoUrl = videoUrl;
    if (videoType !== undefined) lesson.videoType = videoType;

    // Update content
    if (content) {
        let parsedContent;
        try {
            parsedContent = typeof content === 'string' ? JSON.parse(content) : content;
        } catch (err) {
            return next(new AppError('Invalid content format', 400));
        }

        if (!parsedContent || !Array.isArray(parsedContent.blocks)) {
            return next(new AppError('Content must have a valid blocks array', 400));
        }

        lesson.content = parsedContent;

        // Reset approval status if content changed
        if (!isAdmin) {
            lesson.approvalStatus = 'Pending';
        }
    }

    await lesson.save();
    console.log('✅ Lesson updated');

    res.status(200).json({
        message: 'Lesson updated successfully',
        lesson
    });
});

// Submit lesson for approval (Staff)
exports.submitForApproval = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    console.log('📝 Submitting lesson for approval:', id);

    const lesson = await Lesson.findById(id);
    if (!lesson) {
        return next(new AppError('Lesson not found', 404));
    }

    // Check if staff owns this lesson
    if (lesson.createdBy.toString() !== req.user.id && req.user.role !== 'Admin') {
        return next(new AppError('You can only submit your own lessons', 403));
    }

    // Validate lesson has content
    if (!lesson.content || !lesson.content.blocks || lesson.content.blocks.length === 0) {
        return next(new AppError('Cannot submit empty lesson for approval', 400));
    }

    lesson.approvalStatus = 'Pending';
    await lesson.save();

    console.log('✅ Lesson submitted for approval');

    res.status(200).json({
        message: 'Lesson submitted for approval',
        lesson
    });
});

// Approve lesson (Admin)
exports.approveLesson = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { adminRemarks } = req.body;

    console.log('📝 Approving lesson:', id);

    if (req.user.role !== 'Admin') {
        return next(new AppError('Only admins can approve lessons', 403));
    }

    const lesson = await Lesson.findByIdAndUpdate(
        id,
        {
            approvalStatus: 'Approved',
            adminRemarks: adminRemarks || '',
            approvedBy: req.user.id,
            approvedAt: Date.now(),
            isPublished: true,
            publishedAt: Date.now(),
            rejectionReason: null,
            updatedAt: Date.now()
        },
        { new: true }
    ).populate('createdBy', 'name email');

    if (!lesson) {
        return next(new AppError('Lesson not found', 404));
    }

    console.log('✅ Lesson approved');

    res.status(200).json({
        message: 'Lesson approved successfully',
        lesson
    });
});

// Request corrections (Admin)
exports.requestCorrections = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    console.log('📝 Requesting corrections for lesson:', id);

    if (req.user.role !== 'Admin') {
        return next(new AppError('Only admins can request corrections', 403));
    }

    if (!rejectionReason || rejectionReason.trim().length < 10) {
        return next(new AppError('Please provide detailed correction instructions (minimum 10 characters)', 400));
    }

    const lesson = await Lesson.findByIdAndUpdate(
        id,
        {
            approvalStatus: 'Rejected',
            rejectionReason,
            adminRemarks: rejectionReason,
            updatedAt: Date.now()
        },
        { new: true }
    ).populate('createdBy', 'name email');

    if (!lesson) {
        return next(new AppError('Lesson not found', 404));
    }

    console.log('✅ Corrections requested');

    res.status(200).json({
        message: 'Corrections requested successfully',
        lesson
    });
});

// Delete lesson
exports.deleteLesson = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    console.log('📝 Deleting lesson:', id);

    const lesson = await Lesson.findById(id);
    if (!lesson) {
        return next(new AppError('Lesson not found', 404));
    }

    // Authorization
    const isAdmin = req.user.role === 'Admin';
    const isCreator = lesson.createdBy.toString() === req.user.id;

    if (!isAdmin && !isCreator) {
        return next(new AppError('You can only delete your own lessons', 403));
    }

    // Can't delete approved lessons unless admin
    if (lesson.approvalStatus === 'Approved' && !isAdmin) {
        return next(new AppError('Cannot delete approved lessons', 403));
    }

    // Remove from module
    await Module.findByIdAndUpdate(lesson.moduleId, {
        $pull: { lessons: lesson._id }
    });

    // Decrement course total lessons
    await Course.findByIdAndUpdate(lesson.courseId, {
        $inc: { totalLessons: -1 }
    });

    await Lesson.findByIdAndDelete(id);
    console.log('✅ Lesson deleted');

    res.status(200).json({
        message: 'Lesson deleted successfully'
    });
});

// Upload image for EditorJS (inline image in content)
exports.uploadImage = catchAsync(async (req, res, next) => {
    console.log('📝 Uploading image for lesson editor');

    if (!req.file) {
        return next(new AppError('No image file provided', 400));
    }

    console.log('✅ Image uploaded:', req.file.path);

    // Return in EditorJS format
    const fileUrl = `/uploads/content/${req.file.filename}`;
    res.status(200).json({
        success: 1,
        file: {
            url: fileUrl
        }
    });
});

// Attach file/resource to lesson
exports.attachFile = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { type, name } = req.body;

    console.log('📝 Attaching file to lesson:', id);

    if (!req.file) {
        return next(new AppError('No file provided', 400));
    }

    const lesson = await Lesson.findById(id);
    if (!lesson) {
        return next(new AppError('Lesson not found', 404));
    }

    // Authorization
    const isCreator = lesson.createdBy.toString() === req.user.id;
    const isAdmin = req.user.role === 'Admin';

    if (!isCreator && !isAdmin) {
        return next(new AppError('You can only attach files to your own lessons', 403));
    }

    const fileUrl = `/uploads/content/${req.file.filename}`;

    // Add resource
    lesson.resources.push({
        type: type || 'other',
        url: fileUrl,
        name: name || req.file.originalname,
        size: req.file.size
    });

    await lesson.save();
    console.log('✅ File attached');

    res.status(200).json({
        message: 'File attached successfully',
        resource: lesson.resources[lesson.resources.length - 1]
    });
});

// Get staff's lessons
exports.getMyLessons = catchAsync(async (req, res, next) => {
    const lessons = await Lesson.find({ createdBy: req.user.id })
        .populate('moduleId', 'title')
        .populate('courseId', 'title')
        .populate('approvedBy', 'name')
        .select('-content -previousVersions') // Exclude large fields
        .sort({ createdAt: -1 });

    res.status(200).json({
        count: lessons.length,
        lessons
    });
});
