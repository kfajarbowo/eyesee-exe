/**
 * License Server
 * REST API server for license validation and management.
 * 
 * Features:
 * - License activation and validation
 * - Admin endpoints for revocation/management
 * - Simple password authentication for admin
 * 
 * @author EyeSee Team
 */

require('dotenv').config();

// Validate environment variables before starting
const { validateEnvironment } = require('./scripts/validate-env');
validateEnvironment();

const express = require('express');
const cors = require('cors');
const path = require('path');

const licenseRoutes = require('./routes/license');
const adminRoutes = require('./routes/admin');

const app = express();

// Configuration
const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory (Admin Panel UI)
app.use(express.static(path.join(__dirname, 'public')));

// Request logging
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/api/license', licenseRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        serverTime: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'EyeSee License Server',
        version: '1.0.0',
        endpoints: {
            health: 'GET /health',
            license: {
                activate: 'POST /api/license/activate',
                validate: 'GET /api/license/validate/:hardwareId',
                status: 'GET /api/license/status'
            },
            admin: {
                list: 'GET /api/admin/licenses',
                get: 'GET /api/admin/licenses/:hardwareId',
                revoke: 'POST /api/admin/revoke',
                reactivate: 'POST /api/admin/reactivate',
                delete: 'DELETE /api/admin/licenses/:hardwareId',
                stats: 'GET /api/admin/stats'
            }
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('[ERROR]', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, HOST, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║              EyeSee License Server v1.0.0                    ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  Server running on: http://${HOST}:${PORT}                    `);
    console.log(`║  Offline tolerance: ${process.env.OFFLINE_TOLERANCE_HOURS || 24} hours                              `);
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║  Endpoints:                                                  ║');
    console.log('║    POST /api/license/activate     - Activate license         ║');
    console.log('║    GET  /api/license/validate/:id - Validate license         ║');
    console.log('║    GET  /api/admin/licenses       - List all (auth required) ║');
    console.log('║    POST /api/admin/revoke         - Revoke license           ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
});
