/**
 * License Crypto Module
 * Handles encryption, decryption, and cryptographic operations for the license system.
 * 
 * Features:
 * - AES-256-GCM encryption for license data
 * - License key generation with embedded expiry and Hardware ID (pre-binding)
 * - Checksum validation for tamper detection
 * 
 * @module license/license-crypto
 */

const crypto = require('crypto');

/**
 * Configuration for cryptographic operations
 */
const CONFIG = {
    ENCRYPTION_ALGORITHM: 'aes-256-gcm',
    IV_LENGTH: 16,
    AUTH_TAG_LENGTH: 16,
    
    // License key format: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX (6 segments)
    // Seg 1-2: Product code + random
    // Seg 3: Expiry date
    // Seg 4-5: Hardware ID (8 chars encoded)
    // Seg 6: Checksum
    KEY_SEGMENTS: 6,
    SEGMENT_LENGTH: 4,
    CHARSET: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    
    SECRET_KEY: 'eyesee-license-secret-key-2024-v1',
    
    PRODUCT_CODE: 'ES01'
};

/**
 * Generate encryption key from password
 * 
 * @param {string} password - Password to derive key from
 * @returns {Buffer} 32-byte encryption key
 */
function deriveKey(password) {
    return crypto.scryptSync(password, CONFIG.SECRET_KEY, 32);
}

/**
 * Encrypt data using AES-256-GCM
 * 
 * @param {string} plaintext - Data to encrypt
 * @param {string} password - Encryption password
 * @returns {string} Encrypted data (base64 encoded)
 */
function encrypt(plaintext, password) {
    const key = deriveKey(password);
    const iv = crypto.randomBytes(CONFIG.IV_LENGTH);
    const cipher = crypto.createCipheriv(CONFIG.ENCRYPTION_ALGORITHM, key, iv, {
        authTagLength: CONFIG.AUTH_TAG_LENGTH
    });
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine IV + AuthTag + Encrypted data
    const combined = Buffer.concat([
        iv,
        authTag,
        Buffer.from(encrypted, 'hex')
    ]);
    
    return combined.toString('base64');
}

/**
 * Decrypt data using AES-256-GCM
 * 
 * @param {string} encryptedData - Encrypted data (base64 encoded)
 * @param {string} password - Decryption password
 * @returns {string|null} Decrypted data or null if failed
 */
function decrypt(encryptedData, password) {
    try {
        const key = deriveKey(password);
        const combined = Buffer.from(encryptedData, 'base64');
        
        // Extract IV, AuthTag, and encrypted data
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
        console.error('Decryption failed:', error.message);
        return null;
    }
}

/**
 * Encode a number to base36 string
 * 
 * @param {number} num - Number to encode
 * @param {number} length - Desired output length
 * @returns {string} Base36 encoded string
 */
function encodeBase36(num, length) {
    const chars = CONFIG.CHARSET;
    let result = '';
    
    while (num > 0) {
        result = chars[num % chars.length] + result;
        num = Math.floor(num / chars.length);
    }
    
    // Pad with leading characters if needed
    while (result.length < length) {
        result = chars[0] + result;
    }
    
    return result.substring(0, length);
}

/**
 * Decode a base36 string to number
 * 
 * @param {string} str - Base36 string
 * @returns {number} Decoded number
 */
function decodeBase36(str) {
    const chars = CONFIG.CHARSET;
    let result = 0;
    
    for (let i = 0; i < str.length; i++) {
        result = result * chars.length + chars.indexOf(str[i]);
    }
    
    return result;
}

/**
 * Generate checksum for license key
 * 
 * @param {string} data - Data to checksum
 * @returns {string} 4-character checksum
 */
function generateChecksum(data) {
    const hash = crypto
        .createHmac('sha256', CONFIG.SECRET_KEY)
        .update(data)
        .digest('hex');
    
    // Take first 4 characters and convert to our charset
    const num = parseInt(hash.substring(0, 8), 16);
    return encodeBase36(num, CONFIG.SEGMENT_LENGTH);
}

/**
 * Generate a license key with embedded expiry date and Hardware ID (pre-binding)
 * 
 * Format: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX (6 segments)
 * - Segment 1: Random + first 2 chars of product code
 * - Segment 2: Last 2 chars of product code + Random
 * - Segment 3: Expiry date (encoded)
 * - Segment 4: First 4 chars of Hardware ID hash
 * - Segment 5: Next 4 chars of Hardware ID hash
 * - Segment 6: Checksum
 * 
 * @param {Date|string} expiryDate - License expiry date
 * @param {string} hardwareId - Target Hardware ID (32 chars)
 * @returns {string} License key
 */
function generateLicenseKey(expiryDate, hardwareId) {
    const expiry = new Date(expiryDate);
    
    // Validate expiry date
    if (isNaN(expiry.getTime())) {
        throw new Error('Invalid expiry date');
    }
    
    // Validate hardware ID
    if (!hardwareId || hardwareId.length < 8) {
        throw new Error('Invalid hardware ID. Must be at least 8 characters.');
    }
    
    // Normalize hardware ID (uppercase, take first 8 chars for embedding)
    const hwNormalized = hardwareId.toUpperCase().substring(0, 8);
    
    // Segment 1: Random bytes + first 2 chars of product code
    const random1 = crypto.randomBytes(2);
    const seg1 = encodeBase36(random1.readUInt16BE(), 2) + CONFIG.PRODUCT_CODE.substring(0, 2);
    
    // Segment 2: Last 2 chars of product code + Random
    const random2 = crypto.randomBytes(2);
    const seg2 = CONFIG.PRODUCT_CODE.substring(2, 4) + encodeBase36(random2.readUInt16BE(), 2);
    
    // Segment 3: Expiry date encoded (days since epoch / 10)
    const daysFromEpoch = Math.floor(expiry.getTime() / (1000 * 60 * 60 * 24 * 10));
    const seg3 = encodeBase36(daysFromEpoch, CONFIG.SEGMENT_LENGTH);
    
    // Segment 4-5: Hardware ID (first 8 chars, already alphanumeric)
    const seg4 = hwNormalized.substring(0, 4);
    const seg5 = hwNormalized.substring(4, 8);
    
    // Segment 6: Checksum of first 5 segments
    const dataToCheck = seg1 + seg2 + seg3 + seg4 + seg5;
    const seg6 = generateChecksum(dataToCheck);
    
    return `${seg1}-${seg2}-${seg3}-${seg4}-${seg5}-${seg6}`;
}

/**
 * Validate and decode a license key
 * 
 * @param {string} licenseKey - License key to validate
 * @returns {Object} Validation result with expiry date and embedded hardware ID
 */
function validateLicenseKey(licenseKey) {
    const result = {
        valid: false,
        expiryDate: null,
        hardwareId: null,
        error: null
    };
    
    // Check format
    const cleanKey = licenseKey.trim().toUpperCase();
    const segments = cleanKey.split('-');
    
    if (segments.length !== CONFIG.KEY_SEGMENTS) {
        result.error = 'Format key tidak valid. Gunakan format: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX';
        return result;
    }
    
    // Check each segment length
    for (const seg of segments) {
        if (seg.length !== CONFIG.SEGMENT_LENGTH) {
            result.error = 'Format key tidak valid';
            return result;
        }
        
        // Check valid characters
        for (const char of seg) {
            if (!CONFIG.CHARSET.includes(char)) {
                result.error = 'Karakter tidak valid dalam key';
                return result;
            }
        }
    }
    
    const [seg1, seg2, seg3, seg4, seg5, seg6] = segments;
    
    // Verify checksum (of first 5 segments)
    const dataToCheck = seg1 + seg2 + seg3 + seg4 + seg5;
    const expectedChecksum = generateChecksum(dataToCheck);
    
    if (seg6 !== expectedChecksum) {
        result.error = 'License key tidak valid';
        return result;
    }
    
    // Verify product code
    const productCode = seg1.substring(2, 4) + seg2.substring(0, 2);
    if (productCode !== CONFIG.PRODUCT_CODE) {
        result.error = 'Product code tidak valid';
        return result;
    }
    
    // Extract Hardware ID from seg4 + seg5
    const embeddedHardwareId = seg4 + seg5;
    
    // Decode expiry date
    const daysFromEpoch = decodeBase36(seg3);
    const expiryMs = daysFromEpoch * 1000 * 60 * 60 * 24 * 10;
    const expiryDate = new Date(expiryMs);
    
    // Sanity check: expiry should be reasonable (2020-2100)
    const minDate = new Date('2020-01-01');
    const maxDate = new Date('2100-01-01');
    
    if (expiryDate < minDate || expiryDate > maxDate) {
        result.error = 'Tanggal expired tidak valid dalam key';
        return result;
    }
    
    result.valid = true;
    result.expiryDate = expiryDate;
    result.hardwareId = embeddedHardwareId;
    
    return result;
}

module.exports = {
    encrypt,
    decrypt,
    generateLicenseKey,
    validateLicenseKey,
    generateChecksum,
    // Export config for reference
    CONFIG: {
        PRODUCT_CODE: CONFIG.PRODUCT_CODE,
        KEY_SEGMENTS: CONFIG.KEY_SEGMENTS
    }
};
