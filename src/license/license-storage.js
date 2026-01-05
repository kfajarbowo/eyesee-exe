/**
 * License Storage Module
 * Handles secure, encrypted storage of license data using electron-store.
 * 
 * Features:
 * - Encrypted storage with hardware-based key
 * - Clock manipulation detection
 * - Automatic cleanup of corrupted data
 * 
 * @module license/license-storage
 */

// electron-store v8+ compatibility - handle both ESM and CJS exports
const ElectronStore = require('electron-store');
const Store = ElectronStore.default || ElectronStore;

const { getHardwareId } = require('./hardware-id');
const { encrypt, decrypt } = require('./license-crypto');

/**
 * Configuration
 */
const CONFIG = {
    STORE_NAME: 'eyesee-license',
    ENCRYPTION_KEY_SUFFIX: '-storage-key',
    
    // Storage keys
    KEYS: {
        LICENSE_DATA: 'licenseData',
        LAST_CHECK_TIME: 'lastCheckTime',
        ACTIVATION_DATE: 'activationDate',
        BOUND_HARDWARE_ID: 'boundHardwareId'
    }
};

/**
 * License Storage class
 * Manages encrypted license data persistence
 */
class LicenseStorage {
    constructor() {
        this.store = null;
        this.encryptionPassword = null;
        this.initialized = false;
    }

    /**
     * Initialize the storage
     * Must be called before any other operations
     */
    initialize() {
        if (this.initialized) {
            return;
        }

        try {
            // Generate encryption password from hardware ID
            const hardwareId = getHardwareId();
            this.encryptionPassword = hardwareId + CONFIG.ENCRYPTION_KEY_SUFFIX;

            // Initialize electron-store
            // projectName is required for electron-store v11+ when running outside Electron
            this.store = new Store({
                name: CONFIG.STORE_NAME,
                projectName: 'Electron webview', // Must match the app name
                encryptionKey: this.encryptionPassword,
                clearInvalidConfig: true
            });

            this.initialized = true;
            console.log('License storage initialized');
        } catch (error) {
            console.error('Failed to initialize license storage:', error);
            throw error;
        }
    }

    /**
     * Ensure storage is initialized
     */
    ensureInitialized() {
        if (!this.initialized) {
            this.initialize();
        }
    }

    /**
     * Save license data
     * 
     * @param {Object} licenseData - License information to save
     * @param {string} licenseData.licenseKey - The license key
     * @param {Date} licenseData.expiryDate - Expiration date
     * @param {string} licenseData.hardwareId - Bound hardware ID
     */
    saveLicenseData(licenseData) {
        this.ensureInitialized();

        const dataToStore = {
            licenseKey: licenseData.licenseKey,
            expiryDate: licenseData.expiryDate.toISOString(),
            hardwareId: licenseData.hardwareId,
            activatedAt: new Date().toISOString()
        };

        // Encrypt the license data for additional security
        const encrypted = encrypt(JSON.stringify(dataToStore), this.encryptionPassword);
        
        this.store.set(CONFIG.KEYS.LICENSE_DATA, encrypted);
        this.store.set(CONFIG.KEYS.BOUND_HARDWARE_ID, licenseData.hardwareId);
        this.store.set(CONFIG.KEYS.ACTIVATION_DATE, dataToStore.activatedAt);
        
        // Update last check time
        this.updateLastCheckTime();
        
        console.log('License data saved');
    }

    /**
     * Load license data
     * 
     * @returns {Object|null} License data or null if not found/invalid
     */
    loadLicenseData() {
        this.ensureInitialized();

        try {
            const encrypted = this.store.get(CONFIG.KEYS.LICENSE_DATA);
            
            if (!encrypted) {
                return null;
            }

            const decrypted = decrypt(encrypted, this.encryptionPassword);
            
            if (!decrypted) {
                console.warn('Failed to decrypt license data');
                return null;
            }

            const data = JSON.parse(decrypted);
            
            // Convert date strings back to Date objects
            return {
                licenseKey: data.licenseKey,
                expiryDate: new Date(data.expiryDate),
                hardwareId: data.hardwareId,
                activatedAt: new Date(data.activatedAt)
            };
        } catch (error) {
            console.error('Failed to load license data:', error);
            return null;
        }
    }

    /**
     * Check if license exists
     * 
     * @returns {boolean} True if license data exists
     */
    hasLicense() {
        this.ensureInitialized();
        return this.store.has(CONFIG.KEYS.LICENSE_DATA);
    }

    /**
     * Get the bound hardware ID
     * 
     * @returns {string|null} Bound hardware ID or null
     */
    getBoundHardwareId() {
        this.ensureInitialized();
        return this.store.get(CONFIG.KEYS.BOUND_HARDWARE_ID, null);
    }

    /**
     * Update last check timestamp
     * Used for clock manipulation detection
     */
    updateLastCheckTime() {
        this.ensureInitialized();
        this.store.set(CONFIG.KEYS.LAST_CHECK_TIME, Date.now());
    }

    /**
     * Get last check timestamp
     * 
     * @returns {number|null} Last check timestamp or null
     */
    getLastCheckTime() {
        this.ensureInitialized();
        return this.store.get(CONFIG.KEYS.LAST_CHECK_TIME, null);
    }

    /**
     * Detect clock manipulation
     * Returns true if the current time is suspiciously before the last check time
     * 
     * @param {number} toleranceMs - Tolerance in milliseconds (default: 1 hour)
     * @returns {Object} Clock check result
     */
    checkClockManipulation(toleranceMs = 3600000) {
        this.ensureInitialized();

        const lastCheck = this.getLastCheckTime();
        const now = Date.now();

        const result = {
            manipulated: false,
            lastCheckTime: lastCheck ? new Date(lastCheck) : null,
            currentTime: new Date(now),
            timeDifference: lastCheck ? now - lastCheck : null
        };

        if (lastCheck === null) {
            // First run, no previous check
            return result;
        }

        // If current time is more than tolerance behind last check, suspicious
        if (now < lastCheck - toleranceMs) {
            result.manipulated = true;
            console.warn('Clock manipulation detected!', {
                lastCheck: new Date(lastCheck).toISOString(),
                now: new Date(now).toISOString(),
                difference: (lastCheck - now) / 1000 / 60, // minutes
            });
        }

        return result;
    }

    /**
     * Clear all license data
     */
    clearLicenseData() {
        this.ensureInitialized();
        
        this.store.delete(CONFIG.KEYS.LICENSE_DATA);
        this.store.delete(CONFIG.KEYS.BOUND_HARDWARE_ID);
        this.store.delete(CONFIG.KEYS.ACTIVATION_DATE);
        // Keep last check time for security
        
        console.log('License data cleared');
    }

    /**
     * Clear all storage (including security data)
     * Use with caution - mainly for testing
     */
    clearAll() {
        this.ensureInitialized();
        this.store.clear();
        console.log('All license storage cleared');
    }

    /**
     * Get storage file path (for debugging)
     * 
     * @returns {string} Path to the storage file
     */
    getStoragePath() {
        this.ensureInitialized();
        return this.store.path;
    }
}

// Export singleton instance
const licenseStorage = new LicenseStorage();

module.exports = {
    licenseStorage,
    LicenseStorage
};
