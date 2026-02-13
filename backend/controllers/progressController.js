const { Progress, Course, Module } = require('../models/index');

// Update Module Progress (Time-based)
// Update Module Progress (Time-based) - Atomic Implementation
exports.updateProgress = async (req, res) => {
    try {
        const { courseID, moduleID, timeSpent } = req.body;
        const studentID = req.user.id;

        // Validation
        if (!courseID || !moduleID) {
            return res.status(400).json({ message: 'Course ID and Module ID are required' });
        }

        // Get Module details for duration
        const module = await Module.findById(moduleID);
        if (!module) return res.status(404).json({ message: 'Module not found' });

        const timeToAdd = parseInt(timeSpent) || 0;

        // Atomic Update: Increment timeSpent, set lastAccessed
        // We use pure Mongo update to avoid race conditions
        const progress = await Progress.findOneAndUpdate(
            { studentID, courseID },
            {
                $setOnInsert: {
                    studentID,
                    courseID,
                    completedModules: [],
                    percentComplete: 0
                },
                $set: { lastAccessed: new Date() }
            },
            { new: true, upsert: true }
        );

        // Now update the specific module in the array
        // We need to check if it exists in the array first
        const modIndex = progress.moduleProgress.findIndex(m => m.moduleID.toString() === moduleID);

        let modProgress;
        if (modIndex > -1) {
            // Update existing
            progress.moduleProgress[modIndex].timeSpent += timeToAdd;
            progress.moduleProgress[modIndex].lastUpdated = new Date();
            modProgress = progress.moduleProgress[modIndex];
        } else {
            // Push new
            const newEntry = {
                moduleID,
                timeSpent: timeToAdd,
                completed: false,
                lastUpdated: new Date()
            };
            progress.moduleProgress.push(newEntry);
            modProgress = newEntry;
        }

        // Check Completion Rule: > 90% of duration (Stricter rule for real completion)
        // Or 50% as per previous logic. Let's stick to 90% for "Watching" status or 50%?
        // Let's use 80% to be safe but fair.
        const requiredSeconds = (module.duration || 10) * 60 * 0.8;

        let newlyCompleted = false;
        if (!modProgress.completed && modProgress.timeSpent >= requiredSeconds) {
            modProgress.completed = true;
            newlyCompleted = true;

            // Sync with legacy completedModules array
            const alreadyRecorded = progress.completedModules.some(id => id.toString() === moduleID.toString());
            if (!alreadyRecorded) {
                progress.completedModules.push(moduleID);
            }
        }

        // Recalculate Course Percentage
        const totalModules = await Module.countDocuments({ courseId: courseID, status: 'Approved' });
        if (totalModules > 0) {
            const completedCount = progress.completedModules.length;
            progress.percentComplete = Math.round((completedCount / totalModules) * 100);
        }

        await progress.save();

        // Calculate next module ID if completed
        let nextModuleID = null;
        if (newlyCompleted) {
            const nextModule = await Module.findOne({
                courseId: courseID,
                order: { $gt: module.order },
                status: 'Approved'
            }).sort({ order: 1 });
            if (nextModule) nextModuleID = nextModule._id;
        }

        res.status(200).json({
            message: 'Progress updated',
            moduleCompleted: newlyCompleted,
            percentComplete: progress.percentComplete,
            nextModuleID: nextModuleID
        });

    } catch (err) {
        console.error('Progress update error:', err);
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
