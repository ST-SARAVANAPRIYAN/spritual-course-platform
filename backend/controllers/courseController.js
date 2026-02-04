const { Course, Content, Impression, User } = require('../models/index');

// Get Enrolled Courses for Student
exports.getEnrolledCourses = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate({
            path: 'enrolledCourses',
            populate: { path: 'mentors', select: 'name' }
        });
        res.status(200).json(user.enrolledCourses);
    } catch (err) {
        res.status(500).json({ message: 'Fetch failed', error: err.message });
    }
};

// Get Marketplace Courses (Approved & Published)
exports.getMarketplace = async (req, res) => {
    try {
        // Fetch both Approved (Upcoming) and Published (Current) courses
        const courses = await Course.find({
            status: { $in: ['Approved', 'Published'] }
        }).populate('mentors', 'name');

        res.status(200).json(courses);
    } catch (err) {
        console.error('Marketplace error:', err);
        res.status(500).json({ message: 'Marketplace load failed', error: err.message });
    }
};

// Get Course Preview Data (Public)
exports.getCoursePreview = async (req, res) => {
    try {
        const { id } = req.params;
        const { Module } = require('../models/index');
        const course = await Course.findById(id).populate('mentors', 'name');

        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Fetch published modules
        const validStatuses = ['Approved', 'Published'];

        const previewModules = await Module.find({
            courseId: id,
            status: { $in: validStatuses }
        }).select('title status');
        // Assuming no granular preview logic for now or it's handled differently. 
        // Legacy code used 'isFreePreview' on Lessons. 
        // If Modules replace Lessons, we'd check Module fields.

        res.status(200).json({
            course: {
                title: course.title,
                description: course.description,
                mentor: course.mentors && course.mentors.length > 0 ? course.mentors.map(m => m.name).join(', ') : 'No mentor assigned',
                price: course.price,
                thumbnail: course.thumbnail,
                status: course.status
            },
            previews: previewModules // Rename or keep as previews? Keeping generic.
        });
    } catch (err) {
        console.error('Preview error:', err);
        res.status(500).json({ message: 'Failed to load specific preview', error: err.message });
    }
};

// Get Course Details & Content (Modules)
exports.getCourseDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const { Module, User, Enrollment } = require('../models/index');

        const course = await Course.findById(id).populate('mentors', 'name');

        // Fetch Modules
        // Only show Approved/Published modules
        const validStatuses = ['Approved', 'Published'];

        const modules = await Module.find({
            courseId: id,
            status: { $in: validStatuses }
        }).sort({ order: 1 });

        // Logic to check if user has access (purchased and not expired)
        let hasFullAccess = false;
        let isExpired = false;

        if (req.user) {
            const user = await User.findById(req.user.id);
            const enrollment = await Enrollment.findOne({ studentID: req.user.id, courseID: id });

            if (user.role === 'Admin') {
                hasFullAccess = true;
            } else if (enrollment) {
                if (new Date() > enrollment.expiryDate) {
                    isExpired = true;
                    hasFullAccess = false;
                } else {
                    hasFullAccess = true;
                }
            }
        }

        res.status(200).json({
            course,
            modules,
            hasFullAccess,
            isExpired
        });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch details', error: err.message });
    }
};

// ... trackImpression kept same ...

// Track Impression (Play Event)
exports.trackImpression = async (req, res) => {
    try {
        const { courseID, videoID, watchDuration, totalDuration } = req.body;

        const impression = new Impression({
            courseID,
            videoID,
            viewerType: req.user ? 'Registered Student' : 'Unknown',
            viewerIdentity: req.user ? req.user.id : (req.ip || 'Unknown-IP'),
            watchDuration,
            totalVideoDuration: totalDuration,
            ipAddress: req.ip
        });

        await impression.save();
        res.status(200).json({ message: 'Impression recorded' });
    } catch (err) {
        res.status(500).json({ message: 'Tracking failed', error: err.message });
    }
};
// --- Admin Functions ---

// Get All Courses (Admin View)
exports.getAllCoursesAdmin = async (req, res) => {
    try {
        const courses = await Course.find().populate('mentors', 'name email');

        // Debug: Log course statuses
        console.log('\n📚 Courses retrieved for admin:');
        courses.forEach((course, idx) => {
            console.log(`${idx + 1}. ${course.title}`);
            console.log(`   Status: ${course.status}`);
        });

        res.status(200).json(courses);
    } catch (err) {
        res.status(500).json({ message: 'Failed to load courses', error: err.message });
    }
};

// Create Course
exports.createCourse = async (req, res) => {
    try {
        const { title, description, price, mentors, category, difficulty, duration, thumbUrl, status } = req.body;
        const user = await User.findById(req.user.id);

        // Determine course status based on role:
        // Staff creates -> 'Draft' (then submits to Pending via separate action, or auto Pending?)
        // Plan says: Staff create course as draft -> add modules -> submit.

        let initialStatus = 'Draft';

        if (user.role === 'Admin') {
            initialStatus = status || 'Draft';
        }

        const newCourse = new Course({
            title,
            description,
            price,
            mentors: mentors || [], // Array of User IDs
            category,
            difficulty: difficulty || 'Beginner',
            duration: duration || '4 Weeks',
            thumbnail: thumbUrl || 'https://via.placeholder.com/300x200',
            status: initialStatus,
            createdBy: req.user.id
        });
        await newCourse.save();
        res.status(201).json({ message: 'Course created', course: newCourse });
    } catch (err) {
        res.status(500).json({ message: 'Creation failed', error: err.message });
    }
};

// Update Course
exports.updateCourse = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const course = await Course.findByIdAndUpdate(id, updates, { new: true });
        if (!course) return res.status(404).json({ message: 'Course not found' });
        res.status(200).json({ message: 'Course updated', course });
    } catch (err) {
        res.status(500).json({ message: 'Update failed', error: err.message });
    }
};

// Delete Course
exports.deleteCourse = async (req, res) => {
    try {
        const { id } = req.params;
        const { Enrollment } = require('../models/index');

        const course = await Course.findById(id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        // Check for active enrollments
        const enrollments = await Enrollment.find({ courseID: id }).populate('studentID', 'name email');

        if (enrollments.length > 0) {
            return res.status(400).json({
                message: 'Cannot delete course with active enrollments',
                enrollmentCount: enrollments.length,
                students: enrollments.map(e => ({
                    id: e.studentID._id,
                    name: e.studentID.name,
                    email: e.studentID.email
                }))
            });
        }

        // Soft delete - change status to Inactive
        course.status = 'Inactive';
        course.deletedAt = new Date();
        await course.save();

        res.status(200).json({ message: 'Course marked as deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Deletion failed', error: err.message });
    }
};

// Get Course Details with Enrollments (Admin only)
// Get Course Details with Enrollments (Admin only)
exports.getCourseWithEnrollments = async (req, res) => {
    try {
        console.log('getCourseWithEnrollments called with ID:', req.params.id);
        const { id } = req.params;
        const { Enrollment } = require('../models/index');

        const course = await Course.findById(id).populate('mentors', 'name email');
        if (!course) {
            console.log('Course not found:', id);
            return res.status(404).json({ message: 'Course not found' });
        }

        const enrollments = await Enrollment.find({ courseID: id })
            .populate('studentID', 'name email studentID')
            .sort({ enrolledAt: -1 });

        console.log('Found enrollments:', enrollments.length);

        // Filter out enrollments with null studentID (deleted students)
        const validEnrollments = enrollments.filter(e => e.studentID != null);
        console.log('Valid enrollments (with existing students):', validEnrollments.length);

        const enrolledStudents = validEnrollments.map(e => ({
            enrollmentId: e._id,
            studentId: e.studentID._id,
            name: e.studentID.name,
            email: e.studentID.email,
            studentID: e.studentID.studentID,
            enrolledAt: e.enrolledAt,
            expiryDate: e.expiryDate,
            progress: e.progress || 0,
            completed: e.completed || false
        }));

        res.status(200).json({
            course: {
                _id: course._id,
                title: course.title,
                description: course.description,
                category: course.category,
                price: course.price,
                status: course.status,
                mentors: course.mentors,
                difficulty: course.difficulty,
                duration: course.duration,
                thumbnail: course.thumbnail,
                createdAt: course.createdAt
            },
            students: enrolledStudents,
            stats: {
                totalEnrolled: enrolledStudents.length,
                completed: enrolledStudents.filter(s => s.completed).length,
                inProgress: enrolledStudents.filter(s => !s.completed).length
            }
        });
    } catch (err) {
        console.error('Error in getCourseWithEnrollments:', err);
        res.status(500).json({ message: 'Failed to fetch course details', error: err.message });
    }
};

// Remove students from course
exports.removeStudentsFromCourse = async (req, res) => {
    try {
        const { id } = req.params;
        const { studentIds } = req.body;
        const { Enrollment } = require('../models/index');

        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({ message: 'Student IDs required' });
        }

        // Remove enrollments
        const result = await Enrollment.deleteMany({
            courseID: id,
            studentID: { $in: studentIds }
        });

        // Remove course from students' enrolledCourses array
        await User.updateMany(
            { _id: { $in: studentIds } },
            { $pull: { enrolledCourses: id } }
        );

        res.status(200).json({
            message: 'Students removed from course',
            count: result.deletedCount
        });
    } catch (err) {
        res.status(500).json({ message: 'Failed to remove students', error: err.message });
    }
};
