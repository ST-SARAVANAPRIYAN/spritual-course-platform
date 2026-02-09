const express = require('express');
const router = express.Router();
const galleryController = require('../controllers/galleryController');
const authorize = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public Routes
router.get('/images', galleryController.getAllGalleryImages);
router.post('/like/:id', galleryController.toggleLike);
router.get('/image/:id', galleryController.getImageById);

// Admin Routes
router.post('/upload', 
    authorize(['Admin']), 
    upload.single('image'), 
    galleryController.uploadGalleryImage
);

router.get('/stats', 
    authorize(['Admin']), 
    galleryController.getGalleryStats
);

router.put('/image/:id/description', 
    authorize(['Admin']), 
    galleryController.updateImageDescription
);

router.delete('/image/:id', 
    authorize(['Admin']), 
    galleryController.deleteGalleryImage
);

router.patch('/image/:id/deactivate', 
    authorize(['Admin']), 
    galleryController.deactivateGalleryImage
);

router.patch('/image/:id/reactivate', 
    authorize(['Admin']), 
    galleryController.reactivateGalleryImage
);

module.exports = router;
