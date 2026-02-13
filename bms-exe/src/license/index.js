/**
 * License Module Index
 * Central export point for all license-related functionality.
 */

const { licenseManager, LicenseManager, LicenseStatus, CONFIG: MANAGER_CONFIG } = require('./license-manager');
const { getHardwareId, getHardwareDetails } = require('./hardware-id');
const { validateLicenseKey } = require('./license-crypto');
const { licenseStorage } = require('./license-storage');
const serverClient = require('./license-server-client');

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
    
    // Crypto utilities
    validateLicenseKey,
    
    // Storage (for advanced use)
    licenseStorage,
    
    // Server client (for direct server access)
    serverClient
};
