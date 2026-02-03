const { Course, Content, User, Exam, Result, Certificate } = require('../models/index');

// Create Course
exports.createCourse = async (req, res) => {
    try {
        const { title, description, category, price, difficulty, duration } = req.body;
        const mentorID = req.user.id;

        const newCourse = new Course({
            title,
            description,
            category,
            price,
            mentors: [mentorID], // Assign creator as mentor
            difficulty: difficulty || 'Beginner',
            duration: duration || '4 Weeks',
            status: 'Yet to Approve',
            createdBy: mentorID,
            thumbnail: 'https://via.placeholder.com/300x200'
        });

        await newCourse.save();
        res.status(201).json({ message: 'Course draft created and awaiting approval.', course: newCourse });
    } catch (err) {
        res.status(500).json({ message: 'Failed to create course', error: err.message });
    }
};

// Upload Content
exports.uploadContent = async (req, res) => {
    try {
        const { courseID, type, previewDuration } = req.body;
        const uploadedBy = req.user.id;

        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const fileUrl = req.file.path;

        const newContent = new Content({
            courseID,
            uploadedBy,
            type,
            fileUrl,
            previewDuration: previewDuration || 0,
            approvalStatus: 'Pending'
        });

        await newContent.save();
        res.status(201).json({ message: 'Content uploaded and pending approval', content: newContent });
    } catch (err) {
        res.status(500).json({ message: 'Upload failed', error: err.message });
    }
};

// --- Exam System ---

// Create Exam (Staff)
exports.createExam = async (req, res) => {
    try {
        const { courseID, title, duration, passingScore, questions } = req.body;

        const newExam = new Exam({
            courseID,
            title,
            duration: duration || 30,
            passingScore: passingScore || 70,
            questions, // Array of { question, options, correctAnswerIndex }
            createdBy: req.user.id
        });

        await newExam.save();
        res.status(201).json({ message: 'Assessment created successfully', exam: newExam });
    } catch (err) {
        res.status(500).json({ message: 'Exam creation failed', error: err.message });
    }
};

// Submit Exam (Student)
exports.submitExam = async (req, res) => {
    try {
        const { examID, answers } = req.body;
        const studentID = req.user.id;

        const exam = await Exam.findById(examID);
        if (!exam) return res.status(404).json({ message: 'Exam not found' });

        // Grade Exam
        let score = 0;
        exam.questions.forEach((q, idx) => {
            if (answers[idx] == q.correctAnswerIndex) score++;
        });

        const finalScore = (score / exam.questions.length) * 100;
        const status = finalScore >= exam.passingScore ? 'Pass' : 'Fail';

        const result = new Result({
            studentID,
            examID,
            score: finalScore,
            status
        });

        await result.save();

        // If Passed, Issue Certificate
        if (status === 'Pass') {
            const certificate = new Certificate({
                studentID,
                courseID: exam.courseID,
                certificateID: `CERT-${Date.now()}-${Math.floor(Math.random() * 1000)}`
            });
            await certificate.save();
        }

        res.status(200).json({
            message: `Assessment complete. Status: ${status}`,
            score: finalScore,
            status
        });

    } catch (err) {
        res.status(500).json({ message: 'Submission failed', error: err.message });
    }
};

// Check Exam Eligibility
exports.checkEligibility = async (req, res) => {
    try {
        const { courseID } = req.params;
        const studentID = req.user.id;

        const { Progress, Exam } = require('../models/index');

        const exam = await Exam.findOne({ courseID, status: 'Published' });
        if (!exam) return res.status(404).json({ message: 'No assessment available for this path.' });

        const progress = await Progress.findOne({ studentID, courseID });
        const percent = progress ? progress.percentComplete : 0;

        if (percent < exam.activationThreshold) {
            return res.status(403).json({
                eligible: false,
                message: `You must complete ${exam.activationThreshold}% of the pathway to unlock this assessment. Your current progress: ${percent}%`,
                progress: percent,
                threshold: exam.activationThreshold
            });
        }

        res.status(200).json({ eligible: true, examID: exam._id });
    } catch (err) {
        res.status(500).json({ message: 'Eligibility check failed', error: err.message });
    }
};

// Get Enrolled Students for Staff
exports.getEnrolledStudents = async (req, res) => {
    try {
        const { Enrollment, User, Course } = require('../models/index');

        // 1. Find all courses by this mentor
        const myCourses = await Course.find({ mentors: { $in: [req.user.id] } }).select('_id title');
        const courseIDs = myCourses.map(c => c._id);

        // 2. Find all enrollments for these courses
        const enrollments = await Enrollment.find({ courseID: { $in: courseIDs } })
            .populate('studentID', 'name email studentID profilePic')
            .populate('courseID', 'title')
            .sort({ enrolledAt: -1 })
            .lean(); // Convert to standard JS objects to append extra fields

        const { Progress } = require('../models/index');

        // 3. Attach Progress
        const insights = await Promise.all(enrollments.map(async (e) => {
            const progress = await Progress.findOne({ studentID: e.studentID._id, courseID: e.courseID._id });
            return {
                ...e,
                percentComplete: progress ? progress.percentComplete : 0
            };
        }));

        res.status(200).json(insights);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch student insights', error: err.message });
    }
};

// Get Staff Courses
exports.getStaffCourses = async (req, res) => {
    try {
        const courses = await Course.find({ mentors: { $in: [req.user.id] } });
        res.status(200).json(courses);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch courses', error: err.message });
    }
};
