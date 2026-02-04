const express = require('express');
const router = express.Router();
const progressController = require('../controllers/progressController');
const authorize = require('../middleware/auth');

router.post('/mark-complete', authorize(), progressController.markModuleComplete);
router.get('/course/:courseID', authorize(), progressController.getCourseProgress);

module.exports = router;
