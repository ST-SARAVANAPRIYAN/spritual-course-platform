const path = require('path');
const fs = require('fs');
const { Module, Course } = require('../models/index');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

/**
 * Secure File Controller
 * Serves video and PDF files with authentication and authorization
 */

exports.serveSecureFile = catchAsync(async (req, res, next) => {
    const { moduleId } = req.params;
    const userId = req.user.id;

    console.log('🔒 Serving secure file for module:', moduleId);
    console.log('👤 User:', userId);

    // Get module
    const module = await Module.findById(moduleId);
    if (!module) {
        return next(new AppError('Module not found', 404));
    }

    // Check if module has a file (not rich-content)
    if (module.contentType === 'rich-content' || !module.fileUrl) {
        return next(new AppError('This module does not have a file', 400));
    }

    // Get course to check enrollment
    const course = await Course.findById(module.courseId);
    if (!course) {
        return next(new AppError('Course not found', 404));
    }

    // Authorization: Check if user is enrolled or is staff/admin
    const isEnrolled = course.enrolledStudents?.some(s => s.toString() === userId);
    const isStaffOrAdmin = ['Staff', 'Admin'].includes(req.user.role);
    const isMentor = course.mentors?.some(m => m.toString() === userId);

    if (!isEnrolled && !isStaffOrAdmin && !isMentor) {
        console.error('❌ Unauthorized access attempt');
        return next(new AppError('You are not enrolled in this course', 403));
    }

    // Construct file path
    const filePath = path.join(__dirname, '..', module.fileUrl);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        console.error('❌ File not found:', filePath);
        return next(new AppError('File not found on server', 404));
    }

    console.log('✅ Serving file:', filePath);

    // Set appropriate headers
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'application/octet-stream';

    if (ext === '.mp4') contentType = 'video/mp4';
    else if (ext === '.webm') contentType = 'video/webm';
    else if (ext === '.mov') contentType = 'video/quicktime';
    else if (ext === '.pdf') contentType = 'application/pdf';

    // Set headers to prevent caching and force inline display
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Enable range requests for video streaming
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range && contentType.startsWith('video/')) {
        // Parse range header
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;

        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', chunksize);

        const stream = fs.createReadStream(filePath, { start, end });
        stream.pipe(res);
    } else {
        // Send entire file
        res.setHeader('Content-Length', fileSize);
        res.sendFile(filePath);
    }
});
