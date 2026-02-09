/**
 * Enrollment Routes
 * Handles course enrollment API endpoints
 */

const express = require('express');
const router = express.Router();
const enrollmentController = require('../controllers/enrollmentController');
const authorize = require('../middleware/auth');

// All routes require authentication
router.use(authorize());

// Create enrollment
router.post('/', enrollmentController.createEnrollment);

// Get current user's enrollments
router.get('/my', enrollmentController.getMyEnrollments);

// Check if enrolled in a specific course
router.get('/check/:courseId', enrollmentController.checkEnrollment);

module.exports = router;
