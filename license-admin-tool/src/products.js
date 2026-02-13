/**
 * License Admin Tool - Product Configurations
 * 
 * Contains settings for all products.
 * SECRET KEYS MUST MATCH with the client-side license-crypto.js!
 */

const PRODUCTS = {
    bms: {
        code: 'BM01',
        name: 'BMS',
        secretKey: 'bms-license-secret-key-2024-v2',
        color: '#10b981'
    },
    vcomm: {
        code: 'VC01',
        name: 'VComm',
        secretKey: 'vcomm-license-secret-key-2024-v2',
        color: '#f59e0b'
    },
    blm: {
        code: 'BL01',
        name: 'BLM',
        secretKey: 'blm-license-secret-key-2024-v2',
        color: '#ef4444'
    }
};

module.exports = { PRODUCTS };
