/**
 * License Server Client
 * Handles all communication with the central license server.
 */

const http = require('http');
const https = require('https');

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG = {
    serverUrl: 'http://127.0.0.1:3000',
    connectionTimeoutMs: 5000,
    requestTimeoutMs: 10000,
    offlineToleranceHours: 24
};

let config = { ...DEFAULT_CONFIG };

// ============================================================================
// Public API
// ============================================================================

function setServerUrl(url) {
    if (!url) return;
    config.serverUrl = url.replace(/\/$/, '');
    console.log(`[License Client] Server URL set to: ${config.serverUrl}`);
}

async function checkServerConnection() {
    try {
        const response = await makeRequest('GET', '/api/license/status');
        return {
            online: true,
            serverTime: response.serverTime,
            offlineToleranceHours: response.offlineToleranceHours || config.offlineToleranceHours
        };
    } catch (error) {
        return { online: false, error: error.message };
    }
}

async function activateLicense(licenseKey, hardwareId, deviceName = null) {
    try {
        const response = await makeRequest('POST', '/api/license/activate', {
            licenseKey,
            hardwareId,
            deviceName
        });
        
        return {
            success: response.success,
            message: response.message,
            license: response.license || null
        };
    } catch (error) {
        return {
            success: false,
            message: error.message || 'Gagal menghubungi server lisensi',
            offline: error.code === 'OFFLINE'
        };
    }
}

async function validateLicense(hardwareId) {
    try {
        const response = await makeRequest('GET', `/api/license/validate/${hardwareId}`);
        return {
            valid: response.valid,
            activated: response.activated,
            revoked: response.revoked || false,
            revokedReason: response.reason || null,
            license: response.license || null,
            offlineToleranceHours: response.offlineToleranceHours || config.offlineToleranceHours,
            serverTime: response.serverTime,
            checkedAt: new Date().toISOString()
        };
    } catch (error) {
        return {
            valid: null,
            offline: true,
            error: error.message
        };
    }
}

// ============================================================================
// HTTP Request Helper
// ============================================================================

function makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(config.serverUrl + path);
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;
        
        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method: method,
            timeout: config.requestTimeoutMs,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };
        
        const req = httpModule.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        const error = new Error(parsed.error || `HTTP ${res.statusCode}`);
                        error.statusCode = res.statusCode;
                        error.response = parsed;
                        reject(error);
                    }
                } catch (parseError) {
                    reject(new Error('Invalid server response'));
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('[License Client] Connection Error:', error.message, 'Target:', config.serverUrl);
            const offlineError = new Error('Tidak dapat terhubung ke server lisensi');
            offlineError.code = 'OFFLINE';
            offlineError.originalError = error;
            reject(offlineError);
        });
        
        req.on('timeout', () => {
            req.destroy();
            const timeoutError = new Error('Server tidak merespons');
            timeoutError.code = 'TIMEOUT';
            reject(timeoutError);
        });
        
        if (body) {
            req.write(JSON.stringify(body));
        }
        
        req.end();
    });
}

module.exports = {
    setServerUrl,
    checkServerConnection,
    activateLicense,
    validateLicense,
    getConfig: () => ({ ...config })
};
