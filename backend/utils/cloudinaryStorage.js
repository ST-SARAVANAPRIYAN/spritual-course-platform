const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    timeout: 120000 // 120 seconds
});

// Configure Storage Engine
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        let folderName = 'spritual-course-platform/others'; // Default folder

        // Determine folder based on file type
        if (file.mimetype.startsWith('video/')) {
            folderName = 'spritual-course-platform/videos';
        } else if (file.mimetype === 'application/pdf') {
            folderName = 'spritual-course-platform/pdfs';
        } else if (file.mimetype.startsWith('image/')) {
            if (req.body.type === 'profile' || file.fieldname === 'profilePic') {
                folderName = 'spritual-course-platform/profiles';
            } else {
                folderName = 'spritual-course-platform/thumbnails';
            }
        }

        return {
            folder: folderName,
            resource_type: 'auto', // Auto-detect resource type (image, video, raw)
            // public_id: use default unique filename from Cloudinary or existing logic
        };
    },
});

// File Filter (Reused from previous local upload logic)
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

    // Cloudinary supports many formats, but keeping restrictions for now can be good practice
    // or we can expand it. Let's keep it consistent for now.
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only MP4, PDF, and Images (JPEG/PNG/WEBP) are allowed.'), false);
    }
};

// Initialize Multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

module.exports = upload;
