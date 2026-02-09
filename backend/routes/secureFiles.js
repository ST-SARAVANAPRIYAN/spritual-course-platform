const express = require('express');
const router = express.Router();
const secureFileController = require('../controllers/secureFileController');
const authorize = require('../middleware/auth');

// Secure file serving - requires authentication
router.get('/:moduleId',
    authorize(), // Any authenticated user
    secureFileController.serveSecureFile
);

module.exports = router;
