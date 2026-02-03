const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const authorize = require('../middleware/auth');
const upload = require('../utils/cloudinaryStorage');

// All staff routes require 'Staff' role
router.use(authorize(['Staff']));

// @route   POST /api/staff/courses
// @desc    Create a new course draft
router.post('/courses', staffController.createCourse);

// @route   GET /api/staff/courses
// @desc    Get all courses created by the mentor
router.get('/courses', staffController.getStaffCourses);

// @route   POST /api/staff/content
// @desc    Upload video/PDF content for a course
router.post('/content', upload.single('file'), staffController.uploadContent);

// @route   GET /api/staff/students
// @desc    Get seeking students enrolled in mentor's courses
router.get('/students', staffController.getEnrolledStudents);

module.exports = router;
