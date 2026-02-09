/**
 * Enrollment Controller
 * Handles course enrollment operations
 */

const { Enrollment, Course, User } = require('../models/index');

/**
 * Create a new enrollment
 * POST /api/enrollments
 */
exports.createEnrollment = async (req, res) => {
    try {
        const { courseId } = req.body;
        const studentId = req.user.id;

        // Validate course exists
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Check if already enrolled
        const existingEnrollment = await Enrollment.findOne({
            studentID: studentId,
            courseID: courseId,
            status: 'Active'
        });

        if (existingEnrollment) {
            return res.status(400).json({ message: 'You are already enrolled in this course' });
        }

        // Create enrollment
        const enrollment = new Enrollment({
            studentID: studentId,
            courseID: courseId,
            enrolledAt: new Date(),
            status: 'Active',
            progress: 0,
            completed: false
        });

        await enrollment.save();

        // Update user's enrolledCourses array
        await User.findByIdAndUpdate(studentId, {
            $addToSet: { enrolledCourses: courseId }
        });

        res.status(201).json({
            message: 'Enrollment successful',
            enrollment
        });
    } catch (err) {
        console.error('Enrollment error:', err);
        res.status(500).json({ message: 'Enrollment failed', error: err.message });
    }
};

/**
 * Get current user's enrollments
 * GET /api/enrollments/my
 */
exports.getMyEnrollments = async (req, res) => {
    try {
        const studentId = req.user.id;

        const enrollments = await Enrollment.find({ studentID: studentId })
            .populate('courseID', 'title thumbnail category introVideoUrl description price')
            .sort({ enrolledAt: -1 });

        res.status(200).json(enrollments);
    } catch (err) {
        console.error('Fetch enrollments error:', err);
        res.status(500).json({ message: 'Failed to fetch enrollments', error: err.message });
    }
};

/**
 * Check if user is enrolled in a specific course
 * GET /api/enrollments/check/:courseId
 */
exports.checkEnrollment = async (req, res) => {
    try {
        const { courseId } = req.params;
        const studentId = req.user.id;

        const enrollment = await Enrollment.findOne({
            studentID: studentId,
            courseID: courseId,
            status: 'Active'
        });

        res.status(200).json({
            enrolled: !!enrollment,
            enrollment: enrollment || null
        });
    } catch (err) {
        console.error('Check enrollment error:', err);
        res.status(500).json({ message: 'Failed to check enrollment', error: err.message });
    }
};
