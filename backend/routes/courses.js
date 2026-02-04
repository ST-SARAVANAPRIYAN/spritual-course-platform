const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');

const jwt = require('jsonwebtoken');
const { upload } = require('../controllers/uploadController');

// Utility to handle optional authentication for access checks
const optionalAuth = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'innerspark_secret_key');
            req.user = decoded;
        } catch (err) {
            // Invalid token, proceed as guest
        }
    }
    next();
};

// @route   GET /api/courses/enrolled
// @desc    Get user's enrolled courses
router.get('/enrolled', optionalAuth, courseController.getEnrolledCourses);

// @route   GET /api/courses/marketplace
// @desc    Get all published courses
router.get('/marketplace', courseController.getMarketplace);

// @route   GET /api/courses
// @desc    Get all courses (alias for marketplace)
router.get('/', courseController.getMarketplace);

// @route   GET /api/courses/:id/preview
// @desc    Get course preview metadata (Public)
router.get('/:id/preview', courseController.getCoursePreview);

// --- Admin Management Routes ---
const authorize = require('../middleware/auth');

// @route   GET /api/courses/admin/all
router.get('/admin/all', authorize(['Admin']), courseController.getAllCoursesAdmin);

// @route   GET /api/courses/admin/view/:id (Must be before /:id route)
router.get('/admin/view/:id', authorize(['Admin']), courseController.getCourseWithEnrollments);

// @route   GET /api/courses/:id
// @desc    Get course details with optional auth for access check
router.get('/:id', optionalAuth, courseController.getCourseDetails);

// @route   POST /api/courses/track
// @desc    Track video play impression (Anonymous or Student)
router.post('/track', optionalAuth, courseController.trackImpression);

// @route   POST /api/courses
router.post('/', authorize(['Admin', 'Staff']), courseController.createCourse);

// @route   PUT /api/courses/:id
router.put('/:id', authorize(['Admin']), courseController.updateCourse);

// @route   DELETE /api/courses/:id
router.delete('/:id', authorize(['Admin']), courseController.deleteCourse);

// @route   POST /api/courses/:id/remove-students
router.post('/:id/remove-students', authorize(['Admin']), courseController.removeStudentsFromCourse);

// Remaining routes (if any) or existing ones.
// Removing lines 67-117 (Material Management)

module.exports = router;
