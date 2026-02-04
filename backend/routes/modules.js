const express = require('express');
const router = express.Router();
const moduleController = require('../controllers/moduleController');
const authorize = require('../middleware/auth');

// Module routes - all require authentication
router.post('/courses/:courseId/modules',
    authorize(['Staff', 'Admin']),
    moduleController.createModule
);

router.get('/courses/:courseId/modules',
    authorize(),
    moduleController.getCourseModules
);

router.get('/modules/:id',
    authorize(),
    moduleController.getModule
);

router.put('/modules/:id',
    authorize(['Staff', 'Admin']),
    moduleController.updateModule
);

router.delete('/modules/:id',
    authorize(['Staff', 'Admin']),
    moduleController.deleteModule
);

// Reordering routes
router.put('/courses/:courseId/modules/reorder',
    authorize(['Staff', 'Admin']),
    moduleController.reorderModules
);

router.put('/modules/:id/lessons/reorder',
    authorize(['Staff', 'Admin']),
    moduleController.reorderLessons
);

module.exports = router;
