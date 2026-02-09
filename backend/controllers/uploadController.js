const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads/content');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Filter for content (images/videos for Quill editor)
const fileFilter = (req, file, cb) => {
    // Accept images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new AppError('Not an image or video! Please upload only images or videos.', 400), false);
    }
};

// Video filter
const videoFilter = (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new AppError('Invalid file type. Only MP4, WebM, MOV, AVI, and MKV videos are allowed.', 400), false);
    }
};

// PDF filter
const pdfFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new AppError('Invalid file type. Only PDF files are allowed.', 400), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    }
});

exports.upload = upload;
exports.uploadMiddleware = upload.single('file');

exports.uploadFile = catchAsync(async (req, res, next) => {
    if (!req.file) {
        return next(new AppError('No file uploaded', 400));
    }

    // Return the URL
    const fileUrl = `/uploads/content/${req.file.filename}`;

    res.status(200).json({
        status: 'success',
        url: fileUrl,
        filename: req.file.filename,
        mimetype: req.file.mimetype
    });
});

// Video storage configuration with dynamic course directory
const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const { courseId } = req.body;
        if (!courseId) {
            return cb(new AppError('Course ID is required', 400));
        }

        const videoDir = path.join(__dirname, '../uploads/videos', courseId);

        // Create directory if it doesn't exist
        if (!fs.existsSync(videoDir)) {
            fs.mkdirSync(videoDir, { recursive: true });
        }

        cb(null, videoDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `module-${timestamp}${ext}`);
    }
});

const videoUpload = multer({
    storage: videoStorage,
    fileFilter: videoFilter,
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB limit
    }
});

exports.videoUploadMiddleware = videoUpload.single('video');

exports.uploadVideo = catchAsync(async (req, res, next) => {
    if (!req.file) {
        return next(new AppError('No video file uploaded', 400));
    }

    const { courseId } = req.body;
    const fileUrl = `/uploads/videos/${courseId}/${req.file.filename}`;

    res.status(200).json({
        status: 'success',
        fileUrl: fileUrl,
        fileMetadata: {
            originalName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            uploadedAt: new Date()
        }
    });
});

// PDF storage configuration with dynamic course directory
const pdfStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const { courseId } = req.body;
        if (!courseId) {
            return cb(new AppError('Course ID is required', 400));
        }

        const pdfDir = path.join(__dirname, '../uploads/pdfs', courseId);

        // Create directory if it doesn't exist
        if (!fs.existsSync(pdfDir)) {
            fs.mkdirSync(pdfDir, { recursive: true });
        }

        cb(null, pdfDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        cb(null, `module-${timestamp}.pdf`);
    }
});

const pdfUpload = multer({
    storage: pdfStorage,
    fileFilter: pdfFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

exports.pdfUploadMiddleware = pdfUpload.single('pdf');

exports.uploadPDF = catchAsync(async (req, res, next) => {
    if (!req.file) {
        return next(new AppError('No PDF file uploaded', 400));
    }

    const { courseId } = req.body;
    const fileUrl = `/uploads/pdfs/${courseId}/${req.file.filename}`;

    res.status(200).json({
        status: 'success',
        fileUrl: fileUrl,
        fileMetadata: {
            originalName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            uploadedAt: new Date()
        }
    });
});
