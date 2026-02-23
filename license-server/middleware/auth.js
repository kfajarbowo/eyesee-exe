/**
 * Admin Authentication Middleware
 * 
 * Priority:
 * 1. Cek username+password di database admin_users
 * 2. Fallback ke ADMIN_PASSWORD env var (backward compatibility)
 */

const crypto = require('crypto');

function hashPassword(password) {
    return crypto
        .createHmac('sha256', process.env.ADMIN_SECRET || 'eyesee-admin-secret-2024')
        .update(password)
        .digest('hex');
}

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
            error: 'Invalid authorization format. Use: Bearer <token>'
        });
    }

    const token = parts[1];
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    // Coba validasi via database dulu
    try {
        const { adminUsersRepo } = require('../database/db');

        // Token format: "username:password"
        if (token.includes(':')) {
            const colonIdx = token.indexOf(':');
            const username = token.substring(0, colonIdx);
            const password = token.substring(colonIdx + 1);

            const user = adminUsersRepo.findByUsername(username);
            if (user && user.password_hash === hashPassword(password)) {
                adminUsersRepo.updateLastLogin(username);
                req.adminUser = { id: user.id, username: user.username, role: user.role };
                return next();
            }
            return res.status(403).json({ success: false, error: 'Username atau password salah' });
        }
    } catch (err) {
        // DB belum ready, fallback ke env var
    }

    // Fallback: token langsung = password (backward compatibility)
    if (token !== adminPassword) {
        return res.status(403).json({
            success: false,
            error: 'Invalid admin password'
        });
    }

    req.adminUser = { username: 'admin', role: 'admin' };
    next();
}

module.exports = { adminAuth, hashPassword };
