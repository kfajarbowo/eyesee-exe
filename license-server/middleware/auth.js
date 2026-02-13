/**
 * Admin Authentication Middleware
 * Simple password-based authentication for admin endpoints.
 * 
 * @module middleware/auth
 */

/**
 * Verify admin password from Authorization header
 * Expected format: Authorization: Bearer <password>
 */
function adminAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).json({
            success: false,
            error: 'Authorization header required'
        });
    }

    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({
            success: false,
            error: 'Invalid authorization format. Use: Bearer <password>'
        });
    }

    const password = parts[1];
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (password !== adminPassword) {
        return res.status(403).json({
            success: false,
            error: 'Invalid admin password'
        });
    }

    next();
}

module.exports = { adminAuth };
