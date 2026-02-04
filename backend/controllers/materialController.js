const { Content, Course, User, Module } = require('../models/index');

// ========== COURSE MATERIALS MANAGEMENT ==========

// Get all materials for a course (with stats)
exports.getCourseMaterials = async (req, res) => {
    try {
        const { id } = req.params;

        // Get all materials for this course
        const contentItems = await Content.find({ courseID: id })
            .populate('uploadedBy', 'name email role')
            .populate('approvedBy', 'name')
            .sort({ createdAt: -1 });

        // Get modules for this course
        const modules = await Module.find({ courseId: id })
            .populate('createdBy', 'name email role')
            .populate('approvedBy', 'name')
            .sort({ order: 1 });

        console.log(`📦 Stats Debug - Course: ${id}`);
        console.log(`   - Content Items: ${contentItems.length}`);
        console.log(`   - Modules found: ${modules.length}`);
        if (modules.length > 0) console.log(`   - Sample Module: ${modules[0].title} (ID: ${modules[0]._id})`);

        // Normalize Modules to look like Content for the UI
        const normalizedModules = modules.map(m => ({
            _id: m._id,
            title: m.title,
            type: 'Module',
            category: 'module',
            courseID: m.courseId,
            uploadedBy: m.createdBy,
            approvedBy: m.approvedBy,
            approvalStatus: m.approvalStatus,
            createdAt: m.createdAt,
            fileUrl: '#', // No file
            fileSize: 0,
            isModule: true,
            content: m.content // Include content for preview
        }));

        const allMaterials = [...contentItems, ...normalizedModules];

        // Sort by created date descending
        allMaterials.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Calculate stats
        const stats = {
            total: allMaterials.length,
            byCategory: {
                pdf: contentItems.filter(m => m.category && m.category.toLowerCase() === 'pdf').length,
                audio: contentItems.filter(m => m.category && m.category.toLowerCase() === 'audio').length,
                video: contentItems.filter(m => m.category && m.category.toLowerCase() === 'video').length,
                module: modules.length // Add module count
            },
            byStatus: {
                pending: allMaterials.filter(m => m.approvalStatus === 'Pending').length,
                approved: allMaterials.filter(m => m.approvalStatus === 'Approved').length,
                rejected: allMaterials.filter(m => m.approvalStatus === 'Rejected').length
            }
        };

        res.status(200).json({ materials: allMaterials, stats });
    } catch (err) {
        console.error('Stats Error:', err);
        res.status(500).json({ message: 'Failed to fetch materials', error: err.message });
    }
};

// Upload new material (Staff/Admin)
exports.uploadMaterial = async (req, res) => {
    try {
        console.log('📤 Material upload request received');
        console.log('User:', req.user);
        console.log('Body:', req.body);
        console.log('File:', req.file);

        const { courseID, title, type, category, previewDuration } = req.body;
        const file = req.file;

        if (!file) {
            console.error('❌ No file in request');
            return res.status(400).json({ message: 'File is required' });
        }

        console.log('✅ File received:', file.originalname, 'Size:', file.size, 'Path:', file.path);

        // Validate category matches type
        const categoryMap = {
            'PDF': 'pdf',
            'Video': 'video',
            'Audio': 'audio',
            'Note': 'pdf'
        };

        // Auto-approve if uploaded by Admin
        const isAdmin = req.user.role === 'Admin';

        const material = new Content({
            courseID,
            uploadedBy: req.user.id,
            title: title || file.originalname,
            type,
            category: category || categoryMap[type] || 'pdf',
            fileUrl: `/uploads/content/${file.filename}`,
            fileName: file.originalname,
            fileSize: file.size,
            previewDuration: previewDuration || 0,
            approvalStatus: isAdmin ? 'Approved' : 'Pending',
            approvedBy: isAdmin ? req.user.id : null,
            approvedAt: isAdmin ? new Date() : null
        });

        console.log('💾 Saving material to database...');
        await material.save();
        console.log('✅ Material saved successfully:', material._id);

        // Update course totalLessons count
        await Course.findByIdAndUpdate(courseID, {
            $inc: { totalLessons: 1 }
        });

        console.log('✅ Course updated');

        res.status(201).json({
            message: 'Material uploaded successfully',
            material
        });
    } catch (err) {
        console.error('💥 Material upload error:', err);
        res.status(500).json({ message: 'Upload failed', error: err.message });
    }
};

// Update material (Staff - only before approval)
exports.updateMaterial = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, previewDuration } = req.body;
        const file = req.file;

        const material = await Content.findById(id);

        if (!material) {
            return res.status(404).json({ message: 'Material not found' });
        }

        // Staff can only edit their own pending materials
        if (req.user.role === 'Staff' &&
            (material.uploadedBy.toString() !== req.user.id ||
                material.approvalStatus !== 'Pending')) {
            return res.status(403).json({
                message: 'Cannot edit approved materials or materials uploaded by others'
            });
        }

        // Update fields
        if (title) material.title = title;
        if (previewDuration !== undefined) material.previewDuration = previewDuration;
        if (file) {
            material.fileUrl = `/uploads/content/${file.filename}`;
            material.fileName = file.originalname;
            material.fileSize = file.size;
        }
        material.updatedAt = Date.now();

        await material.save();

        res.status(200).json({
            message: 'Material updated successfully',
            material
        });
    } catch (err) {
        res.status(500).json({ message: 'Update failed', error: err.message });
    }
};

// Approve material (Admin only)
exports.approveMaterial = async (req, res) => {
    try {
        const { id } = req.params;
        const { adminRemarks } = req.body;

        const material = await Content.findByIdAndUpdate(
            id,
            {
                approvalStatus: 'Approved',
                adminRemarks: adminRemarks || '',
                approvedBy: req.user.id,
                approvedAt: new Date(),
                rejectionReason: null, // Clear any previous rejection
                updatedAt: Date.now()
            },
            { new: true }
        ).populate('uploadedBy', 'name email');

        if (!material) {
            return res.status(404).json({ message: 'Material not found' });
        }

        res.status(200).json({
            message: 'Material approved successfully',
            material
        });
    } catch (err) {
        res.status(500).json({ message: 'Approval failed', error: err.message });
    }
};

// Request corrections (Admin only)
exports.requestCorrections = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejectionReason } = req.body;

        if (!rejectionReason || rejectionReason.trim().length < 10) {
            return res.status(400).json({
                message: 'Please provide detailed correction instructions (minimum 10 characters)'
            });
        }

        const material = await Content.findByIdAndUpdate(
            id,
            {
                approvalStatus: 'Rejected',
                rejectionReason,
                adminRemarks: rejectionReason,
                updatedAt: Date.now()
            },
            { new: true }
        ).populate('uploadedBy', 'name email');

        if (!material) {
            return res.status(404).json({ message: 'Material not found' });
        }

        res.status(200).json({
            message: 'Corrections requested successfully',
            material
        });
    } catch (err) {
        res.status(500).json({ message: 'Request failed', error: err.message });
    }
};

// Delete material (Admin - permanent delete)
exports.deleteMaterial = async (req, res) => {
    try {
        const { id } = req.params;

        const material = await Content.findByIdAndDelete(id);

        if (!material) {
            return res.status(404).json({ message: 'Material not found' });
        }

        // Decrement course totalLessons count
        await Course.findByIdAndUpdate(material.courseID, {
            $inc: { totalLessons: -1 }
        });

        res.status(200).json({
            message: 'Material deleted permanently',
            material
        });
    } catch (err) {
        res.status(500).json({ message: 'Deletion failed', error: err.message });
    }
};

// Get staff's uploaded materials (for staff dashboard)
exports.getMyMaterials = async (req, res) => {
    try {
        const materials = await Content.find({ uploadedBy: req.user.id })
            .populate('courseID', 'title approvalStatus')
            .populate('approvedBy', 'name')
            .sort({ createdAt: -1 });

        // Filter out materials from inactive/deleted courses
        const activeMaterials = materials.filter(m => 
            m.courseID && m.courseID.approvalStatus !== 'Inactive'
        );

        res.status(200).json(activeMaterials);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch materials', error: err.message });
    }
};

// Get single material details
exports.getMaterial = async (req, res) => {
    try {
        const { id } = req.params;

        const material = await Content.findById(id)
            .populate('uploadedBy', 'name email role')
            .populate('approvedBy', 'name')
            .populate('courseID', 'title');

        if (!material) {
            return res.status(404).json({ message: 'Material not found' });
        }

        res.status(200).json(material);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch material', error: err.message });
    }
};
