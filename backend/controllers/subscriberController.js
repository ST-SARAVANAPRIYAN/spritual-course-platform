const { CourseSubscriber, Course } = require('../models');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

// Subscribe to upcoming course notifications
exports.subscribe = catchAsync(async (req, res, next) => {
    const { courseID, name, email, phone } = req.body;

    if (!courseID || !name || !email || !phone) {
        return next(new AppError('All fields are required', 400));
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return next(new AppError('Please provide a valid email address', 400));
    }

    // Validate phone number (10 digits)
    if (!/^[0-9]{10}$/.test(phone)) {
        return next(new AppError('Phone number must be exactly 10 digits', 400));
    }

    // Check if course exists
    const course = await Course.findById(courseID);
    if (!course) {
        return next(new AppError('Course not found', 404));
    }

    // Check if already subscribed
    const existingSubscription = await CourseSubscriber.findOne({ courseID, email });
    if (existingSubscription) {
        return res.status(200).json({
            status: 'success',
            message: 'You are already subscribed to notifications for this course'
        });
    }

    // Create subscription
    const subscription = await CourseSubscriber.create({
        courseID,
        name,
        email,
        phone
    });

    res.status(201).json({
        status: 'success',
        message: 'Successfully subscribed! We will notify you when this course becomes available.',
        data: { subscription }
    });
});

// Get all subscribers (Admin only)
exports.getAllSubscribers = catchAsync(async (req, res, next) => {
    const subscribers = await CourseSubscriber.find()
        .populate('courseID', 'title category thumbnail status')
        .sort('-createdAt');

    res.status(200).json({
        status: 'success',
        results: subscribers.length,
        data: { subscribers }
    });
});

// Get subscribers for a specific course (Admin only)
exports.getCourseSubscribers = catchAsync(async (req, res, next) => {
    const { courseID } = req.params;

    const subscribers = await CourseSubscriber.find({ courseID })
        .sort('-createdAt');

    res.status(200).json({
        status: 'success',
        results: subscribers.length,
        data: { subscribers }
    });
});

// Delete subscriber (Admin only)
exports.deleteSubscriber = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const subscriber = await CourseSubscriber.findByIdAndDelete(id);

    if (!subscriber) {
        return next(new AppError('Subscriber not found', 404));
    }

    res.status(200).json({
        status: 'success',
        message: 'Subscriber deleted successfully'
    });
});

// Get subscriber stats (Admin only)
exports.getSubscriberStats = catchAsync(async (req, res, next) => {
    const totalSubscribers = await CourseSubscriber.countDocuments();
    const notifiedCount = await CourseSubscriber.countDocuments({ notified: true });
    const pendingCount = await CourseSubscriber.countDocuments({ notified: false });

    // Get top courses by subscriber count
    const topCourses = await CourseSubscriber.aggregate([
        {
            $group: {
                _id: '$courseID',
                subscriberCount: { $sum: 1 }
            }
        },
        {
            $lookup: {
                from: 'courses',
                localField: '_id',
                foreignField: '_id',
                as: 'course'
            }
        },
        { $unwind: '$course' },
        { $sort: { subscriberCount: -1 } },
        { $limit: 5 },
        {
            $project: {
                courseTitle: '$course.title',
                courseStatus: '$course.status',
                subscriberCount: 1
            }
        }
    ]);

    res.status(200).json({
        status: 'success',
        data: {
            totalSubscribers,
            notifiedCount,
            pendingCount,
            topCourses
        }
    });
});
