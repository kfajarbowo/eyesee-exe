/**
 * License Generator Module (Post-binding)
 * 
 * Generates license keys for all products.
 * Keys are generated WITHOUT hardware ID - binding happens on server.
 * 
 * Key Format: XXXX-XXXX-XXXX-XXXX (4 segments)
 */

const crypto = require('crypto');
const { PRODUCTS } = require('./products');

const CONFIG = {
    SEGMENT_LENGTH: 4,
    CHARSET: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
};

// ============================================================================
// Utility Functions
// ============================================================================

function generateRandomSegment(length) {
    const bytes = crypto.randomBytes(length * 2);
    let result = '';
    for (let i = 0; i < length; i++) {
        result += CONFIG.CHARSET[bytes[i] % CONFIG.CHARSET.length];
    }
    return result;
}

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

function generateChecksum(data, secretKey) {
    const hash = crypto.createHmac('sha256', secretKey).update(data).digest('hex');
    const num = parseInt(hash.substring(0, 8), 16);
    return encodeBase36(num, CONFIG.SEGMENT_LENGTH);
}

// ============================================================================
// Main Generator
// ============================================================================

/**
 * Generate a license key for a product
 * 
 * NOTE: Hardware ID is NOT required - binding happens on server
 * 
 * @param {string} productId - Product identifier (bms, vcomm, blm)
 * @returns {object} Result with key and details
 */
function generateLicenseKey(productId) {
    const product = PRODUCTS[productId];
    
    if (!product) {
        return {
            success: false,
            error: `Invalid product: ${productId}. Valid: ${Object.keys(PRODUCTS).join(', ')}`
        };
    }
    
    // Segment 1: Random (2) + Product Code (2)
    const seg1 = generateRandomSegment(2) + product.code.substring(0, 2);
    
    // Segment 2: Product Code (2) + Random (2)
    const seg2 = product.code.substring(2, 4) + generateRandomSegment(2);
    
    // Segment 3: Random (4 - for uniqueness)
    const seg3 = generateRandomSegment(4);
    
    // Segment 4: Checksum
    const dataToCheck = seg1 + seg2 + seg3;
    const seg4 = generateChecksum(dataToCheck, product.secretKey);
    
    const licenseKey = `${seg1}-${seg2}-${seg3}-${seg4}`;
    
    return {
        success: true,
        key: licenseKey,
        product: product.name,
        productCode: product.code,
        createdAt: new Date().toISOString()
    };
}

/**
 * Generate multiple keys at once
 * 
 * @param {string} productId - Product identifier
 * @param {number} count - Number of keys to generate
 * @returns {object} Result with keys array
 */
function generateBatchKeys(productId, count = 1) {
    const product = PRODUCTS[productId];
    
    if (!product) {
        return {
            success: false,
            error: `Invalid product: ${productId}`
        };
    }
    
    const keys = [];
    for (let i = 0; i < count; i++) {
        const result = generateLicenseKey(productId);
        if (result.success) {
            keys.push(result);
        }
    }
    
    return {
        success: true,
        count: keys.length,
        product: product.name,
        keys
    };
}

module.exports = { generateLicenseKey, generateBatchKeys, PRODUCTS };
