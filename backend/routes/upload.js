const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const authorize = require('../middleware/auth');

// Upload route - protected
// POST /api/uploads/content
router.post('/content',
    authorize(['Staff', 'Admin']),
    uploadController.uploadMiddleware,
    uploadController.uploadFile
);

module.exports = router;
