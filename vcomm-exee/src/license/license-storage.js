/**
 * License Storage Module
 * 
 * Handles secure, encrypted storage of license data using electron-store.
 * Stores both license activation data and server validation cache.
 * 
 * @module license/license-storage
 */

const ElectronStore = require('electron-store');
const Store = ElectronStore.default || ElectronStore;

const { getHardwareId } = require('./hardware-id');
const { encrypt, decrypt } = require('./license-crypto');

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
    STORE_NAME: 'vcomm-license',
    PROJECT_NAME: 'VComm Application',
    ENCRYPTION_KEY_SUFFIX: '-storage-key-v2',
    
    KEYS: {
        LICENSE_DATA: 'licenseData',
        SERVER_CACHE: 'serverCache',
        LAST_SERVER_CHECK: 'lastServerCheck',
        BOUND_HARDWARE_ID: 'boundHardwareId'
    }
};

// ============================================================================
// License Storage Class
// ============================================================================

class LicenseStorage {
    constructor() {
        this.store = null;
        this.encryptionPassword = null;
        this.initialized = false;
    }
    
    /**
     * Initialize the storage - must be called before any operations
     */
    initialize() {
        if (this.initialized) return;
        
        try {
            const hardwareId = getHardwareId();
            this.encryptionPassword = hardwareId + CONFIG.ENCRYPTION_KEY_SUFFIX;
            
            this.store = new Store({
                name: CONFIG.STORE_NAME,
                projectName: CONFIG.PROJECT_NAME,
                encryptionKey: this.encryptionPassword,
                clearInvalidConfig: true
            });
            
            this.initialized = true;
            console.log('[Storage] Initialized');
        } catch (error) {
            console.error('[Storage] Initialization failed:', error);
            throw error;
        }
    }
    
    ensureInitialized() {
        if (!this.initialized) {
            this.initialize();
        }
    }
    
    // ========================================================================
    // License Data Operations
    // ========================================================================
    
    /**
     * Save license activation data
     * 
     * @param {Object} data - License data to save
     * @param {string} data.licenseKey - The license key
     * @param {string} data.hardwareId - Bound hardware ID
     * @param {string} data.productCode - Product code from key
     */
    saveLicenseData(data) {
        this.ensureInitialized();
        
        const record = {
            licenseKey: data.licenseKey,
            hardwareId: data.hardwareId,
            productCode: data.productCode || null,
            activatedAt: new Date().toISOString()
        };
        
        const encrypted = encrypt(JSON.stringify(record), this.encryptionPassword);
        
        this.store.set(CONFIG.KEYS.LICENSE_DATA, encrypted);
        this.store.set(CONFIG.KEYS.BOUND_HARDWARE_ID, data.hardwareId);
        
        console.log('[Storage] License data saved');
    }
    
    /**
     * Load license activation data
     * 
     * @returns {Object|null} License data or null
     */
    loadLicenseData() {
        this.ensureInitialized();
        
        try {
            const encrypted = this.store.get(CONFIG.KEYS.LICENSE_DATA);
            
            if (!encrypted) return null;
            
            const decrypted = decrypt(encrypted, this.encryptionPassword);
            if (!decrypted) {
                console.warn('[Storage] Failed to decrypt license data');
                return null;
            }
            
            const data = JSON.parse(decrypted);
            
            return {
                licenseKey: data.licenseKey,
                hardwareId: data.hardwareId,
                productCode: data.productCode,
                activatedAt: new Date(data.activatedAt)
            };
        } catch (error) {
            console.error('[Storage] Load license failed:', error);
            return null;
        }
    }
    
    /**
     * Check if license data exists
     */
    hasLicense() {
        this.ensureInitialized();
        return this.store.has(CONFIG.KEYS.LICENSE_DATA);
    }
    
    /**
     * Get bound hardware ID
     */
    getBoundHardwareId() {
        this.ensureInitialized();
        return this.store.get(CONFIG.KEYS.BOUND_HARDWARE_ID, null);
    }
    
    // ========================================================================
    // Server Validation Cache
    // ========================================================================
    
    /**
     * Save server validation result for offline fallback
     * 
     * @param {Object} serverResponse - Validation response from server
     */
    saveServerCache(serverResponse) {
        this.ensureInitialized();
        
        const cache = {
            valid: serverResponse.valid,
            revoked: serverResponse.revoked || false,
            revokedReason: serverResponse.revokedReason || null,
            serverTime: serverResponse.serverTime || new Date().toISOString(),
            cachedAt: new Date().toISOString(),
            offlineToleranceHours: serverResponse.offlineToleranceHours || 24
        };
        
        this.store.set(CONFIG.KEYS.SERVER_CACHE, cache);
        this.store.set(CONFIG.KEYS.LAST_SERVER_CHECK, Date.now());
        
        console.log('[Storage] Server cache updated');
    }
    
    /**
     * Load cached server validation
     * 
     * @returns {Object|null} Cached data or null
     */
    loadServerCache() {
        this.ensureInitialized();
        return this.store.get(CONFIG.KEYS.SERVER_CACHE, null);
    }
    
    /**
     * Get timestamp of last server check
     * 
     * @returns {number|null} Unix timestamp or null
     */
    getLastServerCheck() {
        this.ensureInitialized();
        return this.store.get(CONFIG.KEYS.LAST_SERVER_CHECK, null);
    }
    
    /**
     * Check if offline tolerance has been exceeded
     * 
     * @param {number} toleranceHours - Maximum hours allowed offline
     * @returns {Object} Offline status
     */
    checkOfflineStatus(toleranceHours = 24) {
        this.ensureInitialized();
        
        const lastCheck = this.getLastServerCheck();
        const cache = this.loadServerCache();
        
        // Use tolerance from cache if available
        const tolerance = cache?.offlineToleranceHours || toleranceHours;
        const toleranceMs = tolerance * 60 * 60 * 1000;
        
        if (!lastCheck) {
            return {
                hasCache: false,
                expired: true,
                message: 'Belum pernah terverifikasi dengan server'
            };
        }
        
        const elapsed = Date.now() - lastCheck;
        const hoursOffline = Math.floor(elapsed / (60 * 60 * 1000));
        
        return {
            hasCache: true,
            lastCheck: new Date(lastCheck),
            hoursOffline,
            toleranceHours: tolerance,
            expired: elapsed > toleranceMs,
            message: elapsed > toleranceMs
                ? `Offline lebih dari ${tolerance} jam. Hubungkan ke server.`
                : `Terakhir diverifikasi ${hoursOffline} jam yang lalu`
        };
    }
    
    // ========================================================================
    // Clear Operations
    // ========================================================================
    
    /**
     * Clear license data only (keeps server cache for security)
     */
    clearLicenseData() {
        this.ensureInitialized();
        
        this.store.delete(CONFIG.KEYS.LICENSE_DATA);
        this.store.delete(CONFIG.KEYS.BOUND_HARDWARE_ID);
        
        console.log('[Storage] License data cleared');
    }
    
    /**
     * Clear everything including caches
     */
    clearAll() {
        this.ensureInitialized();
        this.store.clear();
        console.log('[Storage] All storage cleared');
    }
    
    /**
     * Get storage file path for debugging
     */
    getStoragePath() {
        this.ensureInitialized();
        return this.store.path;
    }
}

// ============================================================================
// Export Singleton
// ============================================================================

const licenseStorage = new LicenseStorage();

module.exports = {
    licenseStorage,
    LicenseStorage
};
