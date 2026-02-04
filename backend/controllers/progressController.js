const { Progress, Course, Module } = require('../models/index');

// Update Module Progress
exports.markModuleComplete = async (req, res) => {
    try {
        const { courseID, moduleID } = req.body;
        const studentID = req.user.id;

        let progress = await Progress.findOne({ studentID, courseID });
        if (!progress) {
            progress = new Progress({ studentID, courseID, completedModules: [] });
        }

        if (!progress.completedModules.includes(moduleID)) {
            progress.completedModules.push(moduleID);

            // Calculate percentage
            const totalModules = await Module.countDocuments({ courseId: courseID, status: 'Approved' }); // Note: courseId in Module schema
            if (totalModules > 0) {
                progress.percentComplete = Math.round((progress.completedModules.length / totalModules) * 100);
            }
        }

        progress.lastAccessed = new Date();
        await progress.save();

        res.status(200).json({ message: 'Module marked as complete', progress });
    } catch (err) {
        res.status(500).json({ message: 'Update progress failed', error: err.message });
    }
};

// Get Course Progress
exports.getCourseProgress = async (req, res) => {
    try {
        const progress = await Progress.findOne({
            studentID: req.user.id,
            courseID: req.params.courseID
        });
        res.status(200).json(progress || { percentComplete: 0, completedModules: [] });
    } catch (err) {
        res.status(500).json({ message: 'Fetch progress failed', error: err.message });
    }
};
