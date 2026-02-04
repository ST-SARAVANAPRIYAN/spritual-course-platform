const express = require('express');
const router = express.Router();
const lessonController = require('../controllers/lessonController');
const authorize = require('../middleware/auth');
const { upload } = require('../controllers/uploadController');

// Lesson CRUD routes
router.post('/modules/:moduleId/lessons',
    authorize(['Staff', 'Admin']),
    lessonController.createLesson
);

router.get('/lessons/:id',
    authorize(),
    lessonController.getLesson
);

router.put('/lessons/:id',
    authorize(['Staff', 'Admin']),
    lessonController.updateLesson
);

router.delete('/lessons/:id',
    authorize(['Staff', 'Admin']),
    lessonController.deleteLesson
);

// Approval workflow routes
router.put('/lessons/:id/submit',
    authorize(['Staff', 'Admin']),
    lessonController.submitForApproval
);

router.put('/lessons/:id/approve',
    authorize(['Admin']),
    lessonController.approveLesson
);

router.put('/lessons/:id/request-corrections',
    authorize(['Admin']),
    lessonController.requestCorrections
);

// File upload routes for EditorJS
router.post('/lessons/upload-image',
    authorize(['Staff', 'Admin']),
    upload.single('image'),
    lessonController.uploadImage
);

router.post('/lessons/:id/attach-file',
    authorize(['Staff', 'Admin']),
    upload.single('file'),
    lessonController.attachFile
);

// Get staff's lessons
router.get('/my-lessons',
    authorize(['Staff', 'Admin']),
    lessonController.getMyLessons
);

module.exports = router;
