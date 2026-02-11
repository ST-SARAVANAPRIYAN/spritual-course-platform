const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const adminController = require('../controllers/adminController');
const authorize = require('../middleware/auth');

// Create Exam (Staff)
router.post('/create', authorize(['Staff', 'Admin']), staffController.createExam);

// Get My Exams (Staff)
router.get('/my-assessments', authorize(['Staff', 'Admin']), async (req, res) => {
    try {
        const { Exam } = require('../models/index');
        const exams = await Exam.find({ createdBy: req.user.id })
            .populate('courseID', 'title')
            .sort({ createdAt: -1 });
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
        
        const { courseID, title, duration, passingScore, activationThreshold, questions } = req.body;
        
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
        
        exam.courseID = courseID || exam.courseID;
        exam.title = title || exam.title;
        exam.duration = duration || exam.duration;
        exam.passingScore = passingScore || exam.passingScore;
        exam.activationThreshold = activationThreshold || exam.activationThreshold;
        exam.questions = transformedQuestions;
        exam.approvalStatus = 'Pending'; // Reset to pending on edit
        
        await exam.save();
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
            exam.rejectionReason = undefined;
            console.log('[EXAM APPROVAL] Approving assessment');
        } else if (action === 'reject') {
            exam.approvalStatus = 'Rejected';
            exam.rejectionReason = rejectionReason || 'Not specified';
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
        const exam = await Exam.findById(req.params.id)
            .populate('courseID', 'title')
            .populate('createdBy', 'name email');
        
        if (!exam) {
            return res.status(404).json({ message: 'Assessment not found' });
        }
        
        res.status(200).json(exam);
    } catch (err) {
        res.status(500).json({ message: 'Fetch failed', error: err.message });
    }
});

module.exports = router;
