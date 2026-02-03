const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authorize = require('../middleware/auth');

// All admin routes require 'Admin' role
router.use(authorize(['Admin']));

// @route   GET /api/admin/pending
// @desc    Get queue of content waiting for approval
router.get('/pending', adminController.getPendingContent);

// @route   POST /api/admin/review
// @desc    Approve or Reject content or exam
router.post('/review', adminController.reviewItem);

// @route   GET /api/admin/stats
// @desc    Get platform-wide statistics
router.get('/stats', adminController.getAdminStats);

// @route   GET /api/admin/ledger
router.get('/ledger', adminController.getFinancialLedger);

// @route   POST /api/admin/override
router.post('/override', adminController.overrideEnrollment);

// @route   POST /api/admin/broadcast
router.post('/broadcast', adminController.sendBroadcast);

const upload = require('../utils/cloudinaryStorage');

// @route   GET /api/admin/analytics
router.get('/analytics', adminController.getAdvancedAnalytics);

// @route   POST /api/admin/banners
router.post('/banners', upload.single('file'), adminController.uploadBanner);

// @route   GET /api/admin/banners
router.get('/banners', adminController.getBanners);

// Certificate Management
router.get('/certificates', adminController.getCertificates);
router.delete('/certificates/:id', adminController.revokeCertificate);

// @route   POST /api/admin/add-staff
router.post('/add-staff', adminController.addStaff);

// User Management Routes
router.get('/users', adminController.getUsers);
router.post('/users', adminController.createUser);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.patch('/users/:id/status', adminController.toggleUserStatus);

module.exports = router;
