const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const uploadDir = 'backend/uploads';
['videos', 'pdfs', 'thumbnails', 'profiles', 'gallery'].forEach(subDir => {
    const dir = path.join(uploadDir, subDir);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let subDir = '';
        if (file.mimetype.startsWith('video/')) subDir = 'videos';
        else if (file.mimetype === 'application/pdf') subDir = 'pdfs';
        else if (file.mimetype.startsWith('image/')) {
            if (req.body.type === 'profile') subDir = 'profiles';
            else if (req.path.includes('gallery')) subDir = 'gallery';
            else subDir = 'thumbnails';
        }
        cb(null, path.join(uploadDir, subDir));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File Filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only MP4, PDF, and Images (JPEG/PNG/WEBP) are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

module.exports = upload;
