const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const authorize = require('../middleware/auth');

// Upload route - protected
// POST /api/uploads/content
// Content upload for Quill editor (images/videos)
router.post('/content',
    authorize(['Staff', 'Admin']),
    uploadController.uploadMiddleware,
    uploadController.uploadFile
);

// Video upload for module content
router.post('/video',
    authorize(['Staff', 'Admin']),
    uploadController.videoUploadMiddleware,
    uploadController.uploadVideo
);

// PDF upload for module content
router.post('/pdf',
    authorize(['Staff', 'Admin']),
    uploadController.pdfUploadMiddleware,
    uploadController.uploadPDF
);

module.exports = router;
