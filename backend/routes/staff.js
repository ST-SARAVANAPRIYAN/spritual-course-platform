const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const authorize = require('../middleware/auth');
const { upload } = require('../controllers/uploadController');

// All staff routes require 'Staff' role
router.use(authorize(['Staff']));

// @route   POST /api/staff/courses
// @desc    Create a new course draft
router.post('/courses', staffController.createCourse);

// @route   GET /api/staff/courses
// @desc    Get all courses created by the mentor
router.get('/courses', staffController.getStaffCourses);

// @route   GET /api/staff/modules
// @desc    Get all modules created by the mentor
router.get('/modules', staffController.getStaffModules);

// @route   GET /api/staff/deleted-courses
// @desc    Get deleted/inactive courses for notification
router.get('/deleted-courses', staffController.getDeletedCourses);

// @route   POST /api/staff/content
// @desc    Upload video/PDF content for a course
router.post('/content', upload.single('file'), staffController.uploadContent);

// @route   GET /api/staff/students
// @desc    Get seeking students enrolled in mentor's courses
router.get('/students', staffController.getEnrolledStudents);

// @route   GET /api/staff/profile
// @desc    Get staff profile
router.get('/profile', staffController.getProfile);

// @route   PUT /api/staff/profile
// @desc    Update staff profile
router.put('/profile', staffController.updateProfile);

// @route   POST /api/staff/change-password
// @desc    Change password
router.post('/change-password', staffController.changePassword);

module.exports = router;
