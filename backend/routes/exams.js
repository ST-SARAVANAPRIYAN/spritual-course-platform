const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const adminController = require('../controllers/adminController');
const authorize = require('../middleware/auth');

// Create Exam (Staff)
router.post('/create', authorize(['Staff', 'Admin']), staffController.createExam);

// Cleanup duplicate assessments (Admin only)
router.post('/cleanup-duplicates', authorize(['Admin']), async (req, res) => {
    try {
        const { Exam } = require('../models/index');
        
        console.log('[CLEANUP] Starting duplicate assessment cleanup...');
        
        // Find all exams grouped by course, title, and creator
        const allExams = await Exam.find({}).sort({ updatedAt: -1, createdAt: -1 });
        const examGroups = new Map();
        let duplicatesFound = 0;
        let duplicatesRemoved = 0;
        
        // Group exams by course + title + creator
        for (let exam of allExams) {
            const key = `${exam.courseID}_${exam.title?.trim()}_${exam.createdBy}`;
            if (!examGroups.has(key)) {
                examGroups.set(key, []);
            }
            examGroups.get(key).push(exam);
        }
        
        // Process each group
        for (let [key, exams] of examGroups) {
            if (exams.length > 1) {
                duplicatesFound += exams.length - 1;
                console.log(`[CLEANUP] Found ${exams.length} duplicates for key: ${key}`);
                
                // Sort by update date (most recent first)
                exams.sort((a, b) => {
                    const aDate = new Date(a.updatedAt || a.createdAt);
                    const bDate = new Date(b.updatedAt || b.createdAt);
                    return bDate - aDate;
                });
                
                // Keep the most recent, remove the others
                const keepExam = exams[0];
                const toRemove = exams.slice(1);
                
                console.log(`[CLEANUP] Keeping most recent: ${keepExam._id} (${keepExam.updatedAt || keepExam.createdAt})`);
                
                for (let duplicate of toRemove) {
                    console.log(`[CLEANUP] Removing duplicate: ${duplicate._id} (${duplicate.updatedAt || duplicate.createdAt})`);
                    await Exam.findByIdAndDelete(duplicate._id);
                    duplicatesRemoved++;
                }
            }
        }
        
        console.log(`[CLEANUP] Cleanup complete. Found: ${duplicatesFound}, Removed: ${duplicatesRemoved}`);
        
        res.status(200).json({ 
            message: 'Duplicate cleanup completed',
            duplicatesFound,
            duplicatesRemoved
        });
    } catch (err) {
        console.error('[CLEANUP] Error during cleanup:', err);
        res.status(500).json({ message: 'Cleanup failed', error: err.message });
    }
});

// Get My Exams (Staff)
router.get('/my-assessments', authorize(['Staff', 'Admin']), async (req, res) => {
    try {
        const { Exam } = require('../models/index');
        const exams = await Exam.find({ createdBy: req.user.id })
            .populate('courseID', 'title')
            .sort({ updatedAt: -1, createdAt: -1 }); // Sort by most recently updated first
        res.status(200).json(exams);
    } catch (err) {
        res.status(500).json({ message: 'Fetch failed', error: err.message });
    }
});

// Update Exam (Staff)
router.put('/:id', authorize(['Staff', 'Admin']), async (req, res) => {
    try {
        const { Exam } = require('../models/index');
        const exam = await Exam.findById(req.params.id);
        
        if (!exam) {
            return res.status(404).json({ message: 'Assessment not found' });
        }
        
        // Only creator or admin can edit
        if (exam.createdBy.toString() !== req.user.id && req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        
        console.log(`[EXAM UPDATE] Updating exam ${req.params.id} by user ${req.user.id}`);
        console.log(`[EXAM UPDATE] Current status: ${exam.approvalStatus}`);
        
        const { courseID, title, duration, passingScore, activationThreshold, questions } = req.body;
        
        // Before updating, check if there are any other pending exams with the same title and course
        // (excluding the current one being updated)
        const duplicateExam = await Exam.findOne({
            _id: { $ne: exam._id }, // Exclude current exam
            courseID: courseID || exam.courseID,
            title: title ? title.trim() : exam.title,
            createdBy: exam.createdBy,
            approvalStatus: 'Pending'
        });
        
        if (duplicateExam) {
            console.log(`[EXAM UPDATE] Found duplicate pending exam ${duplicateExam._id}, removing it`);
            await Exam.findByIdAndDelete(duplicateExam._id);
        }
        
        // Transform questions to match schema
        const transformedQuestions = questions.map((q, index) => {
            let correctIndices = [];
            if (Array.isArray(q.correctAnswerIndices)) {
                correctIndices = q.correctAnswerIndices.map(i => parseInt(i));
            } else if (q.correctAnswerIndex !== undefined) {
                correctIndices = [parseInt(q.correctAnswerIndex)];
            }
            
            return {
                questionText: q.question || q.questionText,
                options: q.options,
                correctOptionIndices: correctIndices
            };
        });
        
        // Update the exam fields
        exam.courseID = courseID || exam.courseID;
        exam.title = title ? title.trim() : exam.title;
        exam.duration = duration || exam.duration;
        exam.passingScore = passingScore || exam.passingScore;
        exam.activationThreshold = activationThreshold || exam.activationThreshold;
        exam.questions = transformedQuestions;
        exam.approvalStatus = 'Pending'; // Reset to pending on edit
        exam.rejectionReason = undefined; // Clear any previous rejection reason
        exam.approvedBy = undefined; // Clear previous approval data
        exam.approvedAt = undefined;
        exam.updatedAt = new Date(); // Explicitly set update timestamp
        
        console.log(`[EXAM UPDATE] Saving updated exam with status: ${exam.approvalStatus}`);
        await exam.save();
        
        console.log(`[EXAM UPDATE] Successfully updated exam ${exam._id}`);
        res.status(200).json({ message: 'Assessment updated successfully', exam });
    } catch (err) {
        console.error('Exam update error:', err);
        res.status(500).json({ message: 'Update failed', error: err.message });
    }
});

// Delete Exam (Staff)
router.delete('/:id', authorize(['Staff', 'Admin']), async (req, res) => {
    try {
        const { Exam } = require('../models/index');
        const exam = await Exam.findById(req.params.id);
        
        if (!exam) {
            return res.status(404).json({ message: 'Assessment not found' });
        }
        
        // Only creator or admin can delete
        if (exam.createdBy.toString() !== req.user.id && req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        
        await Exam.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Assessment deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Delete failed', error: err.message });
    }
});

// Admin: Get Pending Assessments
router.get('/admin/pending', authorize('Admin'), async (req, res) => {
    try {
        const { Exam } = require('../models/index');
        const exams = await Exam.find({ approvalStatus: 'Pending' })
            .populate('courseID', 'title')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });
        res.status(200).json(exams);
    } catch (err) {
        res.status(500).json({ message: 'Fetch failed', error: err.message });
    }
});

// Admin: Approve/Reject Assessment
router.post('/:id/approve', authorize('Admin'), async (req, res) => {
    try {
        const { Exam } = require('../models/index');
        const { action, rejectionReason } = req.body; // action: 'approve' or 'reject'
        
        console.log('[EXAM APPROVAL] Request received:', {
            examId: req.params.id,
            action,
            rejectionReason: rejectionReason ? 'provided' : 'none',
            adminId: req.user.id
        });
        
        const exam = await Exam.findById(req.params.id);
        if (!exam) {
            console.error('[EXAM APPROVAL] Assessment not found:', req.params.id);
            return res.status(404).json({ message: 'Assessment not found' });
        }
        
        console.log('[EXAM APPROVAL] Current exam status:', exam.approvalStatus);
        
        if (action === 'approve') {
            exam.approvalStatus = 'Approved';
            exam.approvedBy = req.user.id;
            exam.approvedAt = new Date();
            exam.rejectionReason = undefined; // Clear any rejection reason
            exam.updatedAt = new Date();
            console.log('[EXAM APPROVAL] Approving assessment');
        } else if (action === 'reject') {
            exam.approvalStatus = 'Rejected';
            exam.rejectionReason = rejectionReason || 'Not specified';
            exam.updatedAt = new Date();
            console.log('[EXAM APPROVAL] Rejecting assessment with reason:', rejectionReason);
        } else {
            console.error('[EXAM APPROVAL] Invalid action:', action);
            return res.status(400).json({ message: 'Invalid action' });
        }
        
        console.log('[EXAM APPROVAL] Saving exam...');
        await exam.save();
        console.log('[EXAM APPROVAL] Exam saved successfully');
        
        res.status(200).json({ message: `Assessment ${action}d successfully`, exam });
    } catch (err) {
        console.error('[EXAM APPROVAL] Error occurred:', err);
        console.error('[EXAM APPROVAL] Error stack:', err.stack);
        res.status(500).json({ message: 'Operation failed', error: err.message });
    }
});

// Submit Exam (Student)
router.post('/submit', authorize(['Student', 'Admin']), staffController.submitExam);

// Check Eligibility (Student)
router.get('/eligibility/:courseID', authorize('Student'), staffController.checkEligibility);

// Get Exams for Course (including approval status)
router.get('/course/:courseID', authorize(['Student', 'Staff', 'Admin']), async (req, res) => {
    try {
        const { Exam } = require('../models/index');
        let query = { courseID: req.params.courseID };
        
        // Students only see approved assessments
        if (req.user.role === 'Student') {
            query.approvalStatus = 'Approved';
        }
        
        const exams = await Exam.find(query).populate('createdBy', 'name');
        res.status(200).json(exams);
    } catch (err) {
        res.status(500).json({ message: 'Fetch failed', error: err.message });
    }
});

// Get Single Exam
router.get('/:id', authorize(['Student', 'Staff', 'Admin']), async (req, res) => {
    try {
        const { Exam } = require('../models/index');
        const examId = req.params.id;
        
        console.log('[EXAM GET] Fetching exam with ID:', examId);
        console.log('[EXAM GET] User requesting:', req.user.id, 'Role:', req.user.role);
        
        // Validate ObjectId format
        if (!examId.match(/^[0-9a-fA-F]{24}$/)) {
            console.log('[EXAM GET] Invalid ObjectId format:', examId);
            return res.status(400).json({ message: 'Invalid assessment ID format' });
        }
        
        const exam = await Exam.findById(examId)
            .populate('courseID', 'title')
            .populate('createdBy', 'name email');
        
        if (!exam) {
            console.log('[EXAM GET] Assessment not found in database:', examId);
            return res.status(404).json({ message: 'Assessment not found' });
        }
        
        console.log('[EXAM GET] Found exam:', exam.title, 'Status:', exam.approvalStatus);
        res.status(200).json(exam);
    } catch (err) {
        console.error('[EXAM GET] Error fetching exam:', err);
        res.status(500).json({ message: 'Fetch failed', error: err.message });
    }
});

// Get all exam IDs for debugging
router.get('/debug/all-ids', authorize(['Admin']), async (req, res) => {
    try {
        const { Exam } = require('../models/index');
        const exams = await Exam.find({}, '_id title approvalStatus createdAt').sort({ createdAt: -1 });
        const examList = exams.map(e => ({
            id: e._id,
            title: e.title,
            status: e.approvalStatus,
            created: e.createdAt
        }));
        res.status(200).json({ total: exams.length, exams: examList });
    } catch (err) {
        res.status(500).json({ message: 'Debug fetch failed', error: err.message });
    }
});

module.exports = router;
