const { Module, Course, User } = require('../models/index');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

/**
 * Module Controller
 * Handles CRUD operations for course modules
 */

// Create new module
exports.createModule = catchAsync(async (req, res, next) => {
    console.log('📦 Creating new module...');
    console.log('User:', req.user);
    console.log('Body:', req.body);

    const { courseId, title, description, content } = req.body;

    // Validation
    if (!courseId || !title) {
        console.error('❌ Missing required fields');
        return next(new AppError('Course ID and title are required', 400));
    }

    // Verify course exists
    const course = await Course.findById(courseId);
    if (!course) {
        console.error('❌ Course not found:', courseId);
        return next(new AppError('Course not found', 404));
    }

    // Check authorization
    const isAdmin = req.user.role === 'Admin';
    const isCourseMentor = course.mentors?.some(m => m.toString() === req.user.id);

    if (!isAdmin && !isCourseMentor) {
        console.error('❌ Unauthorized: User not admin or course mentor');
        return next(new AppError('Only course mentors or admins can create modules', 403));
    }

    // Get current max order for this course
    const maxOrderModule = await Module.findOne({ courseId })
        .sort({ order: -1 })
        .select('order');
    const nextOrder = maxOrderModule ? maxOrderModule.order + 1 : 0;

    // Create module
    const module = new Module({
        courseId,
        title,
        description,
        content: content || '',
        order: nextOrder,
        createdBy: req.user.id,
        status: isAdmin ? 'Approved' : 'Draft' // Admins auto-approve, Staff start as Draft
    });

    await module.save();
    console.log('✅ Module created successfully:', module._id);

    res.status(201).json({
        message: 'Module created successfully',
        module
    });
});

// Get all modules for a course
exports.getCourseModules = catchAsync(async (req, res, next) => {
    const { courseId } = req.params;
    const { includeUnpublished } = req.query;

    console.log('📦 Fetching modules for course:', courseId);

    const course = await Course.findById(courseId);
    if (!course) {
        return next(new AppError('Course not found', 404));
    }

    // Build query
    const query = { courseId };

    // Only show published/approved modules to non-staff
    const isStaffOrAdmin = req.user && ['Staff', 'Admin'].includes(req.user.role);
    if (!isStaffOrAdmin || includeUnpublished !== 'true') {
        query.status = { $in: ['Approved', 'Published'] };
    }

    const modules = await Module.find(query)
        .populate('createdBy', 'name email')
        .populate('approvedBy', 'name')
        .sort({ order: 1 });

    console.log(`✅ Found ${modules.length} modules`);

    res.status(200).json({
        count: modules.length,
        modules
    });
});

// Get single module
exports.getModule = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    console.log('📦 Fetching module:', id);

    const module = await Module.findById(id)
        .populate('createdBy', 'name email')
        .populate('approvedBy', 'name');

    if (!module) {
        console.error('❌ Module not found');
        return next(new AppError('Module not found', 404));
    }

    console.log('✅ Module fetched successfully');

    res.status(200).json({ module });
});

// Update module
exports.updateModule = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { title, description, content, isPublished } = req.body;

    console.log('📦 Updating module:', id);

    const module = await Module.findById(id);
    if (!module) {
        return next(new AppError('Module not found', 404));
    }

    // Authorization check
    const isAdmin = req.user.role === 'Admin';
    const isCreator = module.createdBy.toString() === req.user.id;

    if (!isAdmin && !isCreator) {
        return next(new AppError('You can only edit modules you created', 403));
    }

    // Update fields
    if (title) module.title = title;
    if (description !== undefined) module.description = description;
    if (content !== undefined) module.content = content;

    // Approval/Status Logic
    if (isAdmin) {
        // Admin can set status directly if provided
        if (req.body.status) {
            module.status = req.body.status;
            if (module.status === 'Approved' || module.status === 'Published') {
                module.approvedBy = req.user.id;
                module.approvedAt = Date.now();
                module.rejectionReason = undefined;
            }
        }
    } else {
        // Staff Logic
        // If they ask to 'publish' (legacy flag) or 'submit'
        if (isPublished === true) {
            module.status = 'Pending'; // Submit for approval
            module.rejectionReason = undefined;
        } else if (isPublished === false) {
            // If unpublishing, go back to Draft?
            // Or if they explicitly want to draft it
            module.status = 'Draft';
        }

        // Critical edits reset approval
        if ((title || description || content) && (module.status === 'Approved' || module.status === 'Published')) {
            module.status = 'Pending'; // Re-submit for approval
        }
    }

    await module.save();
    console.log('✅ Module updated');

    res.status(200).json({
        message: 'Module updated successfully',
        module
    });
});

// Delete module
exports.deleteModule = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    console.log('📦 Deleting module:', id);

    const module = await Module.findById(id);
    if (!module) {
        return next(new AppError('Module not found', 404));
    }

    // Only admins can delete modules
    if (req.user.role !== 'Admin') {
        return next(new AppError('Only admins can delete modules', 403));
    }

    await Module.findByIdAndDelete(id);
    console.log('✅ Module deleted');

    res.status(200).json({
        message: 'Module deleted successfully'
    });
});

// Reorder modules
exports.reorderModules = catchAsync(async (req, res, next) => {
    const { courseId } = req.params;
    const { moduleOrders } = req.body; // Array of {id, order}

    console.log('📦 Reordering modules for course:', courseId);

    if (!Array.isArray(moduleOrders)) {
        return next(new AppError('moduleOrders must be an array', 400));
    }

    // Verify all modules belong to this course
    const moduleIds = moduleOrders.map(m => m.id);
    const modules = await Module.find({ _id: { $in: moduleIds }, courseId });

    if (modules.length !== moduleIds.length) {
        return next(new AppError('Some modules do not belong to this course', 400));
    }

    // Authorization
    const isAdmin = req.user.role === 'Admin';
    const course = await Course.findById(courseId);
    const isMentor = course.mentors?.some(m => m.toString() === req.user.id);

    if (!isAdmin && !isMentor) {
        return next(new AppError('Only course mentors or admins can reorder modules', 403));
    }

    // Update orders
    const updatePromises = moduleOrders.map(({ id, order }) =>
        Module.findByIdAndUpdate(id, { order })
    );

    await Promise.all(updatePromises);
    console.log('✅ Modules reordered');

    res.status(200).json({
        message: 'Modules reordered successfully'
    });
});
