/**
 * License API Routes
 * 
 * Public endpoints for license activation and validation.
 * Post-binding: key gets bound to device on first activation.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { licenseRepo, generatedKeysRepo } = require('../database/db');

// ============================================================================
// Configuration
// ============================================================================

const OFFLINE_TOLERANCE_HOURS = parseInt(process.env.OFFLINE_TOLERANCE_HOURS) || 24;

// Product configs for key validation - ALL PRODUCTS INCLUDING EYESEE
const PRODUCTS = {
    BM01: { name: 'BMS', secretKey: 'bms-license-secret-key-2024-v2' },
    BL01: { name: 'BLM', secretKey: 'blm-license-secret-key-2024-v2' },
    VC01: { name: 'VComm', secretKey: 'vcomm-license-secret-key-2024-v2' },
    ES01: { name: 'EyeSee', secretKey: 'eyesee-license-secret-key-2024-v2' }
};

// ============================================================================
// Key Validation Helpers
// ============================================================================

function encodeBase36(num, length) {
    const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    while (num > 0) {
        result = CHARSET[num % CHARSET.length] + result;
        num = Math.floor(num / CHARSET.length);
    }
    while (result.length < length) {
        result = CHARSET[0] + result;
    }
    return result.substring(0, length);
}

function generateChecksum(data, secretKey) {
    const hash = crypto.createHmac('sha256', secretKey).update(data).digest('hex');
    const num = parseInt(hash.substring(0, 8), 16);
    return encodeBase36(num, 4);
}

function validateKeyFormat(licenseKey) {
    const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const cleanKey = licenseKey.trim().toUpperCase();
    const segments = cleanKey.split('-');
    
    if (segments.length !== 4) {
        return { valid: false, error: 'Format key tidak valid' };
    }
    
    for (const seg of segments) {
        if (seg.length !== 4) {
            return { valid: false, error: 'Format key tidak valid' };
        }
        for (const char of seg) {
            if (!CHARSET.includes(char)) {
                return { valid: false, error: 'Karakter tidak valid dalam key' };
            }
        }
    }
    
    const [seg1, seg2, seg3, seg4] = segments;
    
    const productCode = seg1.substring(2, 4) + seg2.substring(0, 2);
    const product = PRODUCTS[productCode];
    
    if (!product) {
        return { valid: false, error: 'Product code tidak valid' };
    }
    
    const dataToCheck = seg1 + seg2 + seg3;
    const expectedChecksum = generateChecksum(dataToCheck, product.secretKey);
    
    if (seg4 !== expectedChecksum) {
        return { valid: false, error: 'License key tidak valid' };
    }
    
    return {
        valid: true,
        productCode,
        productName: product.name
    };
}

// ============================================================================
// Endpoints
// ============================================================================

router.get('/status', (req, res) => {
    res.json({
        online: true,
        serverTime: new Date().toISOString(),
        offlineToleranceHours: OFFLINE_TOLERANCE_HOURS,
        products: Object.keys(PRODUCTS)
    });
});

// ============================================================================
// Check License Key (Before Activation)
// ============================================================================

router.post('/check', (req, res) => {
    try {
        const { licenseKey } = req.body;
        
        if (!licenseKey) {
            return res.status(400).json({ 
                valid: false, 
                error: 'License key diperlukan' 
            });
        }
        
        const normalizedKey = licenseKey.trim().toUpperCase();
        
        // Validate format
        const keyValidation = validateKeyFormat(normalizedKey);
        if (!keyValidation.valid) {
            return res.json({
                valid: false,
                status: 'INVALID_FORMAT',
                error: keyValidation.error,
                message: 'Format license key tidak valid'
            });
        }
        
        // Check if key exists in generated keys
        const generatedKey = generatedKeysRepo.findByKey(normalizedKey);
        if (!generatedKey) {
            return res.json({
                valid: false,
                status: 'NOT_FOUND',
                error: 'License key tidak ditemukan',
                message: 'License key tidak terdaftar di sistem'
            });
        }
        
        // Check if key is already used
        if (generatedKey.is_used) {
            return res.json({
                valid: true,
                status: 'ALREADY_ACTIVATED',
                productCode: keyValidation.productCode,
                message: 'License key sudah diaktifkan',
                activatedBy: generatedKey.activated_by_hardware_id?.substring(0, 20) + '...',
                usedAt: generatedKey.used_at
            });
        }
        
        // Key is valid and available
        res.json({
            valid: true,
            status: 'AVAILABLE',
            productCode: keyValidation.productCode,
            productName: PRODUCTS[keyValidation.productCode]?.name || keyValidation.productCode,
            message: 'License key valid dan dapat diaktifkan'
        });
        
    } catch (error) {
        console.error('[LICENSE] Check error:', error);
        res.status(500).json({ valid: false, error: 'Internal server error' });
    }
});

// ============================================================================
// Activate License
// ============================================================================


router.post('/activate', (req, res) => {
    try {
        const { licenseKey, hardwareId, deviceName } = req.body;
        
        if (!licenseKey) {
            return res.status(400).json({ success: false, error: 'License key diperlukan' });
        }
        
        if (!hardwareId || hardwareId.length < 8) {
            return res.status(400).json({ success: false, error: 'Hardware ID tidak valid' });
        }
        
        const normalizedKey = licenseKey.trim().toUpperCase();
        const normalizedHwId = hardwareId.toUpperCase();
        
        const keyValidation = validateKeyFormat(normalizedKey);
        if (!keyValidation.valid) {
            return res.status(400).json({ success: false, error: keyValidation.error });
        }
        
        // Check if this hardware ID already has a license FOR THIS SPECIFIC PRODUCT
        // We need to find by both hardware ID AND product code
        const allLicensesForDevice = licenseRepo.getAll().filter(
            l => l.hardware_id === normalizedHwId && l.product_code === keyValidation.productCode
        );
        
        if (allLicensesForDevice.length > 0) {
            const existingLicense = allLicensesForDevice[0];
            // Same product - check if it's the same key
            if (existingLicense.license_key === normalizedKey) {
                // Same key, just update last check
                licenseRepo.updateLastCheck(normalizedHwId);
                return res.json({
                    success: true,
                    message: 'Lisensi sudah aktif',
                    license: {
                        hardwareId: existingLicense.hardware_id,
                        productCode: existingLicense.product_code,
                        activatedAt: existingLicense.activated_at
                    }
                });
            } else {
                // Different key for same product - not allowed
                return res.status(400).json({
                    success: false,
                    error: 'Perangkat ini sudah memiliki lisensi aktif untuk produk ini'
                });
            }
        }
        // Different product or no existing license - allow activation
        
        const generatedKey = generatedKeysRepo.findByKey(normalizedKey);
        if (!generatedKey) {
            return res.status(400).json({
                success: false,
                error: 'License key tidak ditemukan'
            });
        }
        
        if (generatedKey.is_used) {
            return res.status(400).json({
                success: false,
                error: 'License key sudah digunakan oleh perangkat lain'
            });
        }
        
        if (generatedKey.product_code !== keyValidation.productCode) {
            return res.status(400).json({
                success: false,
                error: 'License key tidak cocok dengan produk'
            });
        }
        
        generatedKeysRepo.markUsed(normalizedKey, normalizedHwId);
        
        const newLicense = licenseRepo.create({
            license_key: normalizedKey,
            hardware_id: normalizedHwId,
            device_name: deviceName || null,
            product_code: keyValidation.productCode
        });
        
        console.log(`[LICENSE] ACTIVATED: ${normalizedHwId.substring(0, 8)}... (${keyValidation.productName})`);
        
        res.json({
            success: true,
            message: 'Lisensi berhasil diaktifkan!',
            license: {
                hardwareId: newLicense.hardware_id,
                productCode: newLicense.product_code,
                productName: keyValidation.productName,
                activatedAt: newLicense.activated_at
            }
        });
        
    } catch (error) {
        console.error('[LICENSE] Activation error:', error);
        res.status(500).json({ success: false, error: 'Gagal mengaktifkan lisensi' });
    }
});

router.get('/validate/:hardwareId', (req, res) => {
    try {
        const { hardwareId } = req.params;
        
        if (!hardwareId || hardwareId.length < 8) {
            return res.status(400).json({
                valid: false,
                error: 'Hardware ID tidak valid'
            });
        }
        
        const normalizedHwId = hardwareId.toUpperCase();
        const license = licenseRepo.findByHardwareId(normalizedHwId);
        
        if (!license) {
            return res.json({
                valid: false,
                activated: false,
                message: 'Lisensi tidak ditemukan untuk perangkat ini'
            });
        }
        
        licenseRepo.updateLastCheck(normalizedHwId);
        
        if (license.is_revoked) {
            console.log(`[LICENSE] BLOCKED (revoked): ${normalizedHwId.substring(0, 8)}...`);
            return res.json({
                valid: false,
                activated: true,
                revoked: true,
                reason: license.revoked_reason || 'Lisensi telah dinonaktifkan',
                revokedAt: license.revoked_at
            });
        }
        
        res.json({
            valid: true,
            activated: true,
            revoked: false,
            license: {
                hardwareId: license.hardware_id,
                productCode: license.product_code,
                activatedAt: license.activated_at
            },
            serverTime: new Date().toISOString(),
            offlineToleranceHours: OFFLINE_TOLERANCE_HOURS
        });
        
    } catch (error) {
        console.error('[LICENSE] Validation error:', error);
        res.status(500).json({ valid: false, error: 'Server error' });
    }
});

router.post('/check-key', (req, res) => {
    try {
        const { licenseKey } = req.body;
        
        if (!licenseKey) {
            return res.status(400).json({ valid: false, error: 'License key diperlukan' });
        }
        
        const normalizedKey = licenseKey.trim().toUpperCase();
        
        const keyValidation = validateKeyFormat(normalizedKey);
        if (!keyValidation.valid) {
            return res.json({ valid: false, error: keyValidation.error });
        }
        
        const generatedKey = generatedKeysRepo.findByKey(normalizedKey);
        
        if (!generatedKey) {
            return res.json({ valid: false, error: 'Key tidak ditemukan' });
        }
        
        res.json({
            valid: true,
            productCode: keyValidation.productCode,
            productName: keyValidation.productName,
            isUsed: generatedKey.is_used,
            usedByHardwareId: generatedKey.used_by_hardware_id
        });
        
    } catch (error) {
        console.error('[LICENSE] Check key error:', error);
        res.status(500).json({ valid: false, error: 'Server error' });
    }
});

// ============================================================================
// TESTING ENDPOINTS (Development Only)
// For developers to test without installing .exe
// ============================================================================

/**
 * Reset key to unused state (for testing)
 * POST /api/license/test/reset-key
 */
router.post('/test/reset-key', (req, res) => {
    try {
        const { licenseKey } = req.body;
        
        if (!licenseKey) {
            return res.status(400).json({ 
                success: false, 
                error: 'License key required' 
            });
        }
        
        const normalizedKey = licenseKey.trim().toUpperCase();
        const generatedKey = generatedKeysRepo.findByKey(normalizedKey);
        
        if (!generatedKey) {
            return res.status(404).json({ 
                success: false, 
                error: 'License key not found' 
            });
        }
        
        // Reset key to unused
        generatedKeysRepo.resetKeyToUnused(normalizedKey);
        
        // Also delete from active licenses if exists
        const activeLicense = licenseRepo.getAll().find(l => l.license_key === normalizedKey);
        if (activeLicense) {
            licenseRepo.deleteByHardwareId(activeLicense.hardware_id);
        }
        
        console.log(`[TEST] RESET KEY: ${normalizedKey}`);
        
        res.json({
            success: true,
            message: 'License key reset to unused state',
            licenseKey: normalizedKey,
            previousStatus: generatedKey.is_used ? 'USED' : 'UNUSED',
            currentStatus: 'UNUSED'
        });
        
    } catch (error) {
        console.error('[TEST] Reset error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * Simulate activation (mark as used) without real hardware
 * POST /api/license/test/mark-used
 */
router.post('/test/mark-used', (req, res) => {
    try {
        const { licenseKey } = req.body;
        
        if (!licenseKey) {
            return res.status(400).json({ 
                success: false, 
                error: 'License key required' 
            });
        }
        
        const normalizedKey = licenseKey.trim().toUpperCase();
        const generatedKey = generatedKeysRepo.findByKey(normalizedKey);
        
        if (!generatedKey) {
            return res.status(404).json({ 
                success: false, 
                error: 'License key not found' 
            });
        }
        
        if (generatedKey.is_used) {
            return res.status(400).json({ 
                success: false, 
                error: 'License key already used',
                usedBy: generatedKey.activated_by_hardware_id
            });
        }
        
        // Mark as used with test hardware ID
        const testHardwareId = 'TEST-' + crypto.randomBytes(16).toString('hex').toUpperCase();
        generatedKeysRepo.markUsed(normalizedKey, testHardwareId);
        
        // Create fake license entry
        const keyValidation = validateKeyFormat(normalizedKey);
        licenseRepo.create({
            license_key: normalizedKey,
            hardware_id: testHardwareId,
            device_name: 'TEST-DEVICE',
            product_code: keyValidation.productCode
        });
        
        console.log(`[TEST] MARKED AS USED: ${normalizedKey} -> ${testHardwareId}`);
        
        res.json({
            success: true,
            message: 'License key marked as used (test mode)',
            licenseKey: normalizedKey,
            testHardwareId: testHardwareId,
            productCode: keyValidation.productCode,
            status: 'USED'
        });
        
    } catch (error) {
        console.error('[TEST] Mark used error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
