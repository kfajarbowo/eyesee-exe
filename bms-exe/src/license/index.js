/**
 * License Module Index
 * Central export point for all license-related functionality.
 * 
 * @module license
 */

const { licenseManager, LicenseManager, LicenseStatus, CONFIG: MANAGER_CONFIG } = require('./license-manager');
const { getHardwareId, getHardwareDetails } = require('./hardware-id');
const { generateLicenseKey, validateLicenseKey } = require('./license-crypto');
const { licenseStorage } = require('./license-storage');

module.exports = {
    // Main manager instance (singleton)
    licenseManager,
    
    // Classes for custom instantiation
    LicenseManager,
    
    // Enums and constants
    LicenseStatus,
    CONFIG: MANAGER_CONFIG,
    
    // Hardware utilities
    getHardwareId,
    getHardwareDetails,
    
    // Crypto utilities (mainly for the generator tool)
    generateLicenseKey,
    validateLicenseKey,
    
    // Storage (for advanced use cases)
    licenseStorage
};
