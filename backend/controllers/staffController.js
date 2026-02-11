const { Course, Content, User, Exam, Result, Certificate } = require('../models/index');

// Create Course
exports.createCourse = async (req, res) => {
    try {
        const { title, description, category, price, difficulty, duration, introVideoUrl, introText, previewDuration } = req.body;
        const mentorID = req.user.id;

        const newCourse = new Course({
            title,
            description,
            category,
            price,
            mentors: [mentorID], // Assign creator as mentor
            difficulty: difficulty || 'Beginner',
            duration: duration || '4 Weeks',
            introVideoUrl,
            introText,
            previewDuration: previewDuration || 60,
            status: 'Draft', // Staff courses start as Draft
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
            status: 'Pending'
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
        const { courseID, title, duration, passingScore, activationThreshold, questions } = req.body;
        const { Exam } = require('../models/index');

        // Validation
        if (!courseID || !title) {
            return res.status(400).json({ message: 'Course and title are required' });
        }

        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ message: 'At least one question is required' });
        }

        // Check if an assessment for this course already exists (Limit: 1 per course)
        const existingExam = await Exam.findOne({
            courseID: courseID,
            status: { $ne: 'Archived' } // Ignore archived/deleted ones if soft delete is used
        });

        if (existingExam) {
            console.log('[CONSTRAINT CHECK] Found existing exam for course:', existingExam._id);
            return res.status(400).json({
                message: 'This course already has an assessment. A course can only have one assessment. Please edit the existing one.',
                existingExamId: existingExam._id
            });
        }

        // Transform questions to match schema
        const transformedQuestions = questions.map((q, index) => {
            if (!q.question || !q.options || !Array.isArray(q.options)) {
                throw new Error(`Question ${index + 1} is missing required fields`);
            }

            // Support both single and multiple correct answers
            let correctIndices = [];
            if (Array.isArray(q.correctAnswerIndices)) {
                correctIndices = q.correctAnswerIndices.map(i => parseInt(i));
            } else if (q.correctAnswerIndex !== undefined) {
                correctIndices = [parseInt(q.correctAnswerIndex)];
            }

            if (correctIndices.length === 0) {
                throw new Error(`Question ${index + 1} must have at least one correct answer`);
            }

            return {
                questionText: q.question,
                options: q.options,
                correctOptionIndices: correctIndices
            };
        });

        const newExam = new Exam({
            courseID,
            title: title.trim(),
            duration: duration || 30,
            passingScore: passingScore || 70,
            activationThreshold: activationThreshold || 85,
            questions: transformedQuestions,
            createdBy: req.user.id,
            status: 'Draft',
            approvalStatus: 'Pending', // Explicitly set to Pending for admin approval
            updatedAt: new Date()
        });

        await newExam.save();
        console.log('[EXAM CREATED] ID:', newExam._id, 'Title:', newExam.title, 'ApprovalStatus:', newExam.approvalStatus);
        res.status(201).json({ message: 'Assessment created successfully', exam: newExam });
    } catch (err) {
        console.error('Exam creation error:', err);
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

        // Grade Exam - Support multiple correct answers
        let score = 0;
        exam.questions.forEach((q, idx) => {
            const studentAnswer = answers[idx];
            const correctIndices = q.correctOptionIndices || [q.correctOptionIndex]; // Backward compatibility

            // Convert student answer to array if not already
            const studentAnswers = Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer];

            // Check if student selected all correct answers and no incorrect ones
            const correctSet = new Set(correctIndices.map(i => parseInt(i)));
            const studentSet = new Set(studentAnswers.map(i => parseInt(i)));

            // Perfect match: same size and all elements match
            if (correctSet.size === studentSet.size &&
                [...correctSet].every(val => studentSet.has(val))) {
                score++;
            }
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
        const { Enrollment, User, Course, Progress } = require('../models/index');

        console.log('Getting students for mentor:', req.user.id);

        // 1. Find all courses by this mentor
        const myCourses = await Course.find({ mentors: { $in: [req.user.id] } }).select('_id title');
        console.log('Found courses:', myCourses.length);

        if (myCourses.length === 0) {
            console.log('No courses found for mentor');
            return res.status(200).json([]);
        }

        const courseIDs = myCourses.map(c => c._id);
        console.log('Course IDs:', courseIDs);

        // 2. Find all enrollments for these courses
        const enrollments = await Enrollment.find({ courseID: { $in: courseIDs } })
            .populate('studentID', 'name email studentID profilePic')
            .populate('courseID', 'title')
            .sort({ enrolledAt: -1 })
            .lean(); // Convert to standard JS objects to append extra fields

        console.log('Found enrollments:', enrollments.length);

        if (enrollments.length === 0) {
            console.log('No enrollments found for mentor courses');
            return res.status(200).json([]);
        }

        // 3. Attach Progress - filter out enrollments with missing references
        const validEnrollments = enrollments.filter(e => {
            const isValid = e.studentID && e.courseID;
            if (!isValid) {
                console.log('Filtering out invalid enrollment:', e._id, 'Missing:', !e.studentID ? 'studentID' : 'courseID');
            }
            return isValid;
        });

        console.log('Valid enrollments after filtering:', validEnrollments.length);

        const insights = await Promise.all(validEnrollments.map(async (e) => {
            try {
                const progress = await Progress.findOne({
                    studentID: e.studentID._id,
                    courseID: e.courseID._id
                });

                const result = {
                    ...e,
                    percentComplete: progress ? progress.percentComplete : 0
                };

                console.log(`Progress for student ${e.studentID.name}: ${result.percentComplete}%`);
                return result;

            } catch (progressErr) {
                console.error('Error fetching progress for enrollment:', e._id, progressErr);
                return {
                    ...e,
                    percentComplete: 0
                };
            }
        }));

        console.log('Returning insights:', insights.length);
        res.status(200).json(insights);

    } catch (err) {
        console.error('Error in getEnrolledStudents:', err);
        res.status(500).json({
            message: 'Failed to fetch student insights',
            error: err.message,
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
};

// Get Staff Courses
exports.getStaffCourses = async (req, res) => {
    try {
        const courses = await Course.find({
            mentors: { $in: [req.user.id] },
            status: { $ne: 'Archived' } // Exclude archived courses
        });
        res.status(200).json(courses);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch courses', error: err.message });
    }
};

// Get Staff Modules (Replaces Materials)
exports.getStaffModules = async (req, res) => {
    try {
        const { Module } = require('../models/index');
        const modules = await Module.find({
            createdBy: req.user.id,
            status: { $ne: 'Archived' }
        }).populate('courseId', 'title');

        res.status(200).json(modules);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch modules', error: err.message });
    }
};

// Get Deleted/Inactive Courses for Staff (for notifications)
exports.getDeletedCourses = async (req, res) => {
    try {
        const deletedCourses = await Course.find({
            mentors: { $in: [req.user.id] },
            status: 'Archived'
        }).select('title deletedAt category');

        res.status(200).json(deletedCourses);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch deleted courses', error: err.message });
    }
};

// Get Staff Profile
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password -verificationToken -resetPasswordToken');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(user);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch profile', error: err.message });
    }
};

// Update Staff Profile
exports.updateProfile = async (req, res) => {
    try {
        const {
            name, fatherName, motherName, dob,
            doorNumber, streetName, town, district, pincode,
            phone, additionalPhone,
            accountHolderName, accountNumber, bankName, ifscCode, branchName
        } = req.body;

        const updateData = {
            name,
            fatherName,
            motherName,
            dob,
            phone,
            additionalPhone,
            'address.doorNumber': doorNumber,
            'address.streetName': streetName,
            'address.town': town,
            'address.district': district,
            'address.pincode': pincode,
            'bankDetails.accountHolderName': accountHolderName,
            'bankDetails.accountNumber': accountNumber,
            'bankDetails.bankName': bankName,
            'bankDetails.ifscCode': ifscCode,
            'bankDetails.branchName': branchName,
            lastEditedAt: Date.now()
        };

        // Remove undefined values
        Object.keys(updateData).forEach(key =>
            updateData[key] === undefined && delete updateData[key]
        );

        const user = await User.findByIdAndUpdate(
            req.user.id,
            updateData,
            { new: true, runValidators: true }
        ).select('-password -verificationToken -resetPasswordToken');

        res.status(200).json({ message: 'Profile updated successfully', user });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update profile', error: err.message });
    }
};

// Change Password
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current password and new password are required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ message: 'New password must be at least 8 characters long' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify current password
        const bcrypt = require('bcryptjs');
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.lastEditedAt = Date.now();
        await user.save();

        res.status(200).json({ message: 'Password changed successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to change password', error: err.message });
    }
};
