const express = require('express');
const router = express.Router();
const subscriberController = require('../controllers/subscriberController');
const authorize = require('../middleware/auth');

// Public route - anyone can subscribe
router.post('/subscribe', subscriberController.subscribe);

// Admin routes - protected
router.use(authorize(['Admin']));
router.get('/all', subscriberController.getAllSubscribers);
router.get('/stats', subscriberController.getSubscriberStats);
router.get('/course/:courseID', subscriberController.getCourseSubscribers);
router.delete('/:id', subscriberController.deleteSubscriber);

module.exports = router;
