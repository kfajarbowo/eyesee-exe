/**
 * Admin API Routes
 * 
 * Endpoints for license management and key generation.
 * All routes require authentication.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { adminAuth } = require('../middleware/auth');
const { licenseRepo, generatedKeysRepo } = require('../database/db');

router.use(adminAuth);

// ============================================================================
// Key Generation Configuration - ALL 4 PRODUCTS
// ============================================================================

const KEY_CONFIG = {
    SEGMENT_LENGTH: 4,
    CHARSET: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    PRODUCTS: {
        BM01: { name: 'BMS', secretKey: 'bms-license-secret-key-2024-v2' },
        BL01: { name: 'BLM', secretKey: 'blm-license-secret-key-2024-v2' },
        VC01: { name: 'VComm', secretKey: 'vcomm-license-secret-key-2024-v2' },
        ES01: { name: 'EyeSee', secretKey: 'eyesee-license-secret-key-2024-v2' }
    }
};

// ============================================================================
// Key Generation Helpers
// ============================================================================

function generateRandomSegment(length) {
    const bytes = crypto.randomBytes(length * 2);
    let result = '';
    for (let i = 0; i < length; i++) {
        result += KEY_CONFIG.CHARSET[bytes[i] % KEY_CONFIG.CHARSET.length];
    }
    return result;
}

function encodeBase36(num, length) {
    const chars = KEY_CONFIG.CHARSET;
    let result = '';
    while (num > 0) {
        result = chars[num % chars.length] + result;
        num = Math.floor(num / chars.length);
    }
    while (result.length < length) {
        result = chars[0] + result;
    }
    return result.substring(0, length);
}

function generateChecksum(data, secretKey) {
    const hash = crypto.createHmac('sha256', secretKey).update(data).digest('hex');
    const num = parseInt(hash.substring(0, 8), 16);
    return encodeBase36(num, KEY_CONFIG.SEGMENT_LENGTH);
}

function generateLicenseKey(productCode) {
    const product = KEY_CONFIG.PRODUCTS[productCode];
    if (!product) throw new Error(`Unknown product: ${productCode}`);
    
    const seg1 = generateRandomSegment(2) + productCode.substring(0, 2);
    const seg2 = productCode.substring(2, 4) + generateRandomSegment(2);
    const seg3 = generateRandomSegment(4);
    const dataToCheck = seg1 + seg2 + seg3;
    const seg4 = generateChecksum(dataToCheck, product.secretKey);
    
    return `${seg1}-${seg2}-${seg3}-${seg4}`;
}

// ============================================================================
// Key Generation Endpoints
// ============================================================================

router.post('/generate-keys', (req, res) => {
    try {
        const { productCode, count = 1 } = req.body;
        
        if (!productCode || !KEY_CONFIG.PRODUCTS[productCode]) {
            return res.status(400).json({
                success: false,
                error: 'Invalid product code. Valid codes: ' + Object.keys(KEY_CONFIG.PRODUCTS).join(', ')
            });
        }
        
        const numKeys = Math.min(Math.max(1, parseInt(count)), 100);
        const generatedKeys = [];
        
        for (let i = 0; i < numKeys; i++) {
            const licenseKey = generateLicenseKey(productCode);
            
            generatedKeysRepo.add({
                license_key: licenseKey,
                product_code: productCode
            });
            
            generatedKeys.push({
                key: licenseKey,
                productCode,
                productName: KEY_CONFIG.PRODUCTS[productCode].name
            });
        }
        
        console.log(`[ADMIN] Generated ${numKeys} keys for ${productCode}`);
        
        res.json({
            success: true,
            count: generatedKeys.length,
            keys: generatedKeys
        });
        
    } catch (error) {
        console.error('[ADMIN] Generate keys error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/generated-keys', (req, res) => {
    try {
        const { status = 'all' } = req.query;
        let keys = generatedKeysRepo.getAll();
        
        if (status === 'unused') {
            keys = keys.filter(k => !k.is_used);
        } else if (status === 'used') {
            keys = keys.filter(k => k.is_used);
        }
        
        res.json({
            success: true,
            count: keys.length,
            stats: generatedKeysRepo.getStats(),
            keys
        });
        
    } catch (error) {
        console.error('[ADMIN] List keys error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.delete('/generated-keys/:key', (req, res) => {
    try {
        const { key } = req.params;
        const keyData = generatedKeysRepo.findByKey(key);
        
        if (!keyData) {
            return res.status(404).json({ success: false, error: 'Key not found' });
        }
        
        if (keyData.is_used) {
            return res.status(400).json({ 
                success: false, 
                error: 'Cannot delete used key' 
            });
        }
        
        generatedKeysRepo.delete(key);
        res.json({ success: true, message: 'Key deleted' });
        
    } catch (error) {
        console.error('[ADMIN] Delete key error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// ============================================================================
// License Management Endpoints
// ============================================================================

router.get('/licenses', (req, res) => {
    try {
        const licenses = licenseRepo.getAll();
        
        res.json({
            success: true,
            count: licenses.length,
            stats: licenseRepo.getStats(),
            licenses: licenses.map(l => ({
                id: l.id,
                licenseKey: l.license_key,
                hardwareId: l.hardware_id,
                deviceName: l.device_name,
                productCode: l.product_code,
                activatedAt: l.activated_at,
                lastCheckAt: l.last_check_at,
                isRevoked: l.is_revoked,
                revokedAt: l.revoked_at,
                revokedReason: l.revoked_reason
            }))
        });
    } catch (error) {
        console.error('[ADMIN] List licenses error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.get('/licenses/:hardwareId', (req, res) => {
    try {
        const { hardwareId } = req.params;
        const license = licenseRepo.findByHardwareId(hardwareId);
        
        if (!license) {
            return res.status(404).json({ success: false, error: 'License not found' });
        }

        res.json({ success: true, license });
    } catch (error) {
        console.error('[ADMIN] Get license error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.post('/revoke', (req, res) => {
    try {
        const { hardwareId, reason } = req.body;
        
        if (!hardwareId) {
            return res.status(400).json({ success: false, error: 'Hardware ID is required' });
        }

        const license = licenseRepo.findByHardwareId(hardwareId);
        
        if (!license) {
            return res.status(404).json({ success: false, error: 'License not found' });
        }

        if (license.is_revoked) {
            return res.status(400).json({ success: false, error: 'Already revoked' });
        }

        const updated = licenseRepo.revoke(hardwareId, reason || 'Revoked by admin');
        
        console.log(`[ADMIN] REVOKED: ${hardwareId.substring(0, 8)}...`);

        res.json({
            success: true,
            message: 'License revoked',
            license: {
                hardwareId: updated.hardware_id,
                revokedAt: updated.revoked_at,
                reason: updated.revoked_reason
            }
        });

    } catch (error) {
        console.error('[ADMIN] Revoke error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.post('/reactivate', (req, res) => {
    try {
        const { hardwareId } = req.body;
        
        if (!hardwareId) {
            return res.status(400).json({ success: false, error: 'Hardware ID is required' });
        }

        const license = licenseRepo.findByHardwareId(hardwareId);
        
        if (!license) {
            return res.status(404).json({ success: false, error: 'License not found' });
        }

        if (!license.is_revoked) {
            return res.status(400).json({ success: false, error: 'License is not revoked' });
        }

        const updated = licenseRepo.reactivate(hardwareId);
        
        console.log(`[ADMIN] REACTIVATED: ${hardwareId.substring(0, 8)}...`);

        res.json({
            success: true,
            message: 'License reactivated',
            license: { hardwareId: updated.hardware_id }
        });

    } catch (error) {
        console.error('[ADMIN] Reactivate error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.delete('/licenses/:hardwareId', (req, res) => {
    try {
        const { hardwareId } = req.params;
        // Check if license exists first
        const license = licenseRepo.findByHardwareId(hardwareId);
        if (!license) {
            return res.status(404).json({ success: false, error: 'License not found' });
        }
        
        // Reset the generated key to unused so it can be reactivated
        const generatedKey = generatedKeysRepo.findByKey(license.license_key);
        if (generatedKey) {
            generatedKeysRepo.resetKeyToUnused(license.license_key);
        }
        
        // Delete the license
        licenseRepo.deleteByHardwareId(hardwareId);

        console.log(`[ADMIN] DELETED: ${hardwareId.substring(0, 8)}... (key reset to unused)`);
        res.json({ success: true, message: 'License deleted permanently, key can be reused' });

    } catch (error) {
        console.error('[ADMIN] Delete error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.get('/stats', (req, res) => {
    try {
        const keyStats = generatedKeysRepo.getStats();
        const licenseStats = licenseRepo.getStats();
        
        res.json({
            success: true,
            stats: {
                generatedKeys: keyStats,
                activatedLicenses: licenseStats
            }
        });

    } catch (error) {
        console.error('[ADMIN] Stats error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.get('/products', (req, res) => {
    const products = Object.entries(KEY_CONFIG.PRODUCTS).map(([code, info]) => ({
        code,
        name: info.name
    }));
    
    res.json({ success: true, products });
});

module.exports = router;
