/**
 * License Crypto Module (Post-binding)
 * 
 * License Key Format: XXXX-XXXX-XXXX-XXXX (4 segments)
 * 
 * | Segment | Content                    |
 * |---------|----------------------------|
 * | 1       | Random (2) + Product (2)   |
 * | 2       | Product (2) + Random (2)   |
 * | 3       | Random (4 - uniqueness)    |
 * | 4       | Checksum                   |
 * 
 * NOTE: Hardware ID is NOT embedded in key.
 * Binding happens on server during first activation.
 * 
 * @module license/license-crypto
 */

const crypto = require('crypto');

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
    ENCRYPTION_ALGORITHM: 'aes-256-gcm',
    IV_LENGTH: 16,
    AUTH_TAG_LENGTH: 16,
    
    KEY_SEGMENTS: 4,
    SEGMENT_LENGTH: 4,
    CHARSET: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    
    // Must match server-side
    SECRET_KEY: 'vcomm-license-secret-key-2024-v2',
    PRODUCT_CODE: 'VC01'
};

// ============================================================================
// Encryption Functions
// ============================================================================

function deriveKey(password) {
    return crypto.scryptSync(password, CONFIG.SECRET_KEY, 32);
}

function encrypt(plaintext, password) {
    const key = deriveKey(password);
    const iv = crypto.randomBytes(CONFIG.IV_LENGTH);
    
    const cipher = crypto.createCipheriv(CONFIG.ENCRYPTION_ALGORITHM, key, iv, {
        authTagLength: CONFIG.AUTH_TAG_LENGTH
    });
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    const combined = Buffer.concat([
        iv,
        authTag,
        Buffer.from(encrypted, 'hex')
    ]);
    
    return combined.toString('base64');
}

function decrypt(encryptedData, password) {
    try {
        const key = deriveKey(password);
        const combined = Buffer.from(encryptedData, 'base64');
        
        const iv = combined.subarray(0, CONFIG.IV_LENGTH);
        const authTag = combined.subarray(CONFIG.IV_LENGTH, CONFIG.IV_LENGTH + CONFIG.AUTH_TAG_LENGTH);
        const encrypted = combined.subarray(CONFIG.IV_LENGTH + CONFIG.AUTH_TAG_LENGTH);
        
        const decipher = crypto.createDecipheriv(CONFIG.ENCRYPTION_ALGORITHM, key, iv, {
            authTagLength: CONFIG.AUTH_TAG_LENGTH
        });
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encrypted, null, 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('[Crypto] Decryption failed:', error.message);
        return null;
    }
}

// ============================================================================
// License Key Functions
// ============================================================================

function encodeBase36(num, length) {
    const chars = CONFIG.CHARSET;
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

function generateChecksum(data) {
    const hash = crypto
        .createHmac('sha256', CONFIG.SECRET_KEY)
        .update(data)
        .digest('hex');
    
    const num = parseInt(hash.substring(0, 8), 16);
    return encodeBase36(num, CONFIG.SEGMENT_LENGTH);
}

/**
 * Validate a license key format
 * 
 * NOTE: This only validates format. 
 * Server validation is required to check if key exists and is valid.
 * 
 * @param {string} licenseKey - License key to validate
 * @returns {Object} Validation result
 */
function validateLicenseKey(licenseKey) {
    const result = {
        valid: false,
        productCode: null,
        error: null
    };
    
    const cleanKey = licenseKey.trim().toUpperCase();
    const segments = cleanKey.split('-');
    
    // Check segment count (4 segments)
    if (segments.length !== CONFIG.KEY_SEGMENTS) {
        result.error = 'Format key tidak valid. Gunakan format: XXXX-XXXX-XXXX-XXXX';
        return result;
    }
    
    // Check each segment
    for (const segment of segments) {
        if (segment.length !== CONFIG.SEGMENT_LENGTH) {
            result.error = 'Format key tidak valid';
            return result;
        }
        
        for (const char of segment) {
            if (!CONFIG.CHARSET.includes(char)) {
                result.error = 'Karakter tidak valid dalam key';
                return result;
            }
        }
    }
    
    const [seg1, seg2, seg3, seg4] = segments;
    
    // Extract product code
    const productCode = seg1.substring(2, 4) + seg2.substring(0, 2);
    
    // Verify product code matches this app
    if (productCode !== CONFIG.PRODUCT_CODE) {
        result.error = 'License key bukan untuk aplikasi ini';
        return result;
    }
    
    // Verify checksum
    const dataToCheck = seg1 + seg2 + seg3;
    const expectedChecksum = generateChecksum(dataToCheck);
    
    if (seg4 !== expectedChecksum) {
        result.error = 'License key tidak valid';
        return result;
    }
    
    result.valid = true;
    result.productCode = productCode;
    
    return result;
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
    encrypt,
    decrypt,
    validateLicenseKey,
    generateChecksum,
    CONFIG: {
        PRODUCT_CODE: CONFIG.PRODUCT_CODE,
        KEY_SEGMENTS: CONFIG.KEY_SEGMENTS
    }
};
