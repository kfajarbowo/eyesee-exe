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

module.exports = router;
