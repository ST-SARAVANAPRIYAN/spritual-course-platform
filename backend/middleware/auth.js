const jwt = require('jsonwebtoken');
const { User } = require('../models/index');

/**
 * Middleware to verify JWT and User Role
 * @param {Array} roles - Allowed roles for this route
 */
const authorize = (roles = []) => {
    if (typeof roles === 'string') {
        roles = [roles];
    }

    return async (req, res, next) => {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'Unauthorized: No token provided' });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'innerspark_secret_key');
            
            // SECURITY CHECK: Verify user still exists and is active
            const user = await User.findById(decoded.id).select('active role name isDefaultAdmin');
            
            if (!user) {
                return res.status(401).json({ 
                    message: 'User account no longer exists',
                    invalidAccount: true 
                });
            }
            
            if (user.active === false) {
                return res.status(403).json({ 
                    message: 'Your account has been deactivated by the administrator. Please contact support for assistance.',
                    inactive: true 
                });
            }
            
            req.user = {
                ...decoded,
                isDefaultAdmin: user.isDefaultAdmin || false
            };

            // Check Maintenance Mode
            const Settings = require('../models/Settings');
            const settings = await Settings.findOne();
            if (settings && settings.isMaintenanceMode && req.user.role !== 'Admin') {
                return res.status(503).json({
                    message: settings.maintenanceMessage || 'System under maintenance',
                    maintenance: true
                });
            }

            if (roles.length && !roles.includes(req.user.role)) {
                return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
            }

            next();
        } catch (err) {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
    };
};

module.exports = authorize;
