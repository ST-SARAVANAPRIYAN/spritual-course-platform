const { Gallery, User } = require('../models/index');
const path = require('path');
const fs = require('fs').promises;

// Upload Gallery Image (Admin Only)
exports.uploadGalleryImage = async (req, res) => {
    try {
        const { description } = req.body;

        // Validate description
        if (!description || description.length < 10 || description.length > 100) {
            return res.status(400).json({ 
                message: 'Description must be between 10 and 100 characters' 
            });
        }

        // Check if file exists
        if (!req.file) {
            return res.status(400).json({ message: 'No image file uploaded' });
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(req.file.mimetype)) {
            // Delete uploaded file
            await fs.unlink(req.file.path);
            return res.status(400).json({ 
                message: 'Only JPEG, JPG, and PNG images are allowed' 
            });
        }

        // Validate file size (10KB - 500KB)
        const fileSize = req.file.size;
        const minSize = 10 * 1024; // 10KB
        const maxSize = 500 * 1024; // 500KB

        if (fileSize < minSize || fileSize > maxSize) {
            // Delete uploaded file
            await fs.unlink(req.file.path);
            return res.status(400).json({ 
                message: `Image size must be between 10KB and 500KB. Your image is ${(fileSize / 1024).toFixed(2)}KB` 
            });
        }

        // Create gallery entry
        const galleryImage = new Gallery({
            imageUrl: req.file.path.replace(/\\/g, '/'), // Normalize path
            description: description.trim(),
            uploadedBy: req.user.id,
            fileSize: fileSize,
            fileName: req.file.filename
        });

        await galleryImage.save();

        // Populate uploader info
        await galleryImage.populate('uploadedBy', 'name email');

        res.status(201).json({
            message: 'Gallery image uploaded successfully',
            image: galleryImage
        });

    } catch (err) {
        // Clean up file if error occurs
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkErr) {
                console.error('Error deleting file:', unlinkErr);
            }
        }
        res.status(500).json({ 
            message: 'Failed to upload gallery image', 
            error: err.message 
        });
    }
};

// Get All Gallery Images (Public)
exports.getAllGalleryImages = async (req, res) => {
    try {
        const { page = 1, limit = 20, active = true } = req.query;

        const query = { active: active === 'true' };

        const images = await Gallery.find(query)
            .populate('uploadedBy', 'name')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await Gallery.countDocuments(query);

        res.status(200).json({
            images,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (err) {
        res.status(500).json({ 
            message: 'Failed to fetch gallery images', 
            error: err.message 
        });
    }
};

// Get Gallery Statistics (Admin Only)
exports.getGalleryStats = async (req, res) => {
    try {
        const totalImages = await Gallery.countDocuments({ active: true });
        const totalLikes = await Gallery.aggregate([
            { $match: { active: true } },
            { $group: { _id: null, totalLikes: { $sum: '$likes' } } }
        ]);

        const mostLiked = await Gallery.findOne({ active: true })
            .sort({ likes: -1 })
            .populate('uploadedBy', 'name');

        const recentUploads = await Gallery.find({ active: true })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('uploadedBy', 'name');

        res.status(200).json({
            totalImages,
            totalLikes: totalLikes.length > 0 ? totalLikes[0].totalLikes : 0,
            mostLiked,
            recentUploads
        });

    } catch (err) {
        res.status(500).json({ 
            message: 'Failed to fetch gallery statistics', 
            error: err.message 
        });
    }
};

// Like/Unlike Image (Public)
exports.toggleLike = async (req, res) => {
    try {
        const { id } = req.params;
        const { identifier } = req.body; // IP address or session ID from frontend

        if (!identifier) {
            return res.status(400).json({ message: 'Identifier required' });
        }

        const image = await Gallery.findById(id);
        if (!image) {
            return res.status(404).json({ message: 'Image not found' });
        }

        const hasLiked = image.likedBy.includes(identifier);

        if (hasLiked) {
            // Unlike
            image.likedBy = image.likedBy.filter(id => id !== identifier);
            image.likes = Math.max(0, image.likes - 1);
        } else {
            // Like
            image.likedBy.push(identifier);
            image.likes += 1;
        }

        await image.save();

        res.status(200).json({
            message: hasLiked ? 'Image unliked' : 'Image liked',
            liked: !hasLiked,
            likes: image.likes
        });

    } catch (err) {
        res.status(500).json({ 
            message: 'Failed to toggle like', 
            error: err.message 
        });
    }
};

// Update Image Description (Admin Only)
exports.updateImageDescription = async (req, res) => {
    try {
        const { id } = req.params;
        const { description } = req.body;

        if (!description || description.length < 10 || description.length > 100) {
            return res.status(400).json({ 
                message: 'Description must be between 10 and 100 characters' 
            });
        }

        const image = await Gallery.findByIdAndUpdate(
            id,
            { description: description.trim() },
            { new: true }
        ).populate('uploadedBy', 'name email');

        if (!image) {
            return res.status(404).json({ message: 'Image not found' });
        }

        res.status(200).json({
            message: 'Description updated successfully',
            image
        });

    } catch (err) {
        res.status(500).json({ 
            message: 'Failed to update description', 
            error: err.message 
        });
    }
};

// Delete Gallery Image (Admin Only)
exports.deleteGalleryImage = async (req, res) => {
    try {
        const { id } = req.params;

        const image = await Gallery.findById(id);
        if (!image) {
            return res.status(404).json({ message: 'Image not found' });
        }

        // Delete file from filesystem
        try {
            await fs.unlink(image.imageUrl);
        } catch (fileErr) {
            console.error('Error deleting file:', fileErr);
            // Continue even if file deletion fails
        }

        // Delete from database
        await Gallery.findByIdAndDelete(id);

        res.status(200).json({
            message: 'Gallery image deleted successfully'
        });

    } catch (err) {
        res.status(500).json({ 
            message: 'Failed to delete gallery image', 
            error: err.message 
        });
    }
};

// Soft Delete (Set inactive) (Admin Only)
exports.deactivateGalleryImage = async (req, res) => {
    try {
        const { id } = req.params;

        const image = await Gallery.findByIdAndUpdate(
            id,
            { active: false },
            { new: true }
        );

        if (!image) {
            return res.status(404).json({ message: 'Image not found' });
        }

        res.status(200).json({
            message: 'Gallery image deactivated successfully',
            image
        });

    } catch (err) {
        res.status(500).json({ 
            message: 'Failed to deactivate gallery image', 
            error: err.message 
        });
    }
};

// Reactivate Image (Admin Only)
exports.reactivateGalleryImage = async (req, res) => {
    try {
        const { id } = req.params;

        const image = await Gallery.findByIdAndUpdate(
            id,
            { active: true },
            { new: true }
        );

        if (!image) {
            return res.status(404).json({ message: 'Image not found' });
        }

        res.status(200).json({
            message: 'Gallery image reactivated successfully',
            image
        });

    } catch (err) {
        res.status(500).json({ 
            message: 'Failed to reactivate gallery image', 
            error: err.message 
        });
    }
};

// Get Single Image Details
exports.getImageById = async (req, res) => {
    try {
        const { id } = req.params;

        const image = await Gallery.findById(id)
            .populate('uploadedBy', 'name email profilePic');

        if (!image) {
            return res.status(404).json({ message: 'Image not found' });
        }

        res.status(200).json({ image });

    } catch (err) {
        res.status(500).json({ 
            message: 'Failed to fetch image details', 
            error: err.message 
        });
    }
};
