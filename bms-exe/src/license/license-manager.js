/**
 * License Manager Module (Post-binding)
 * 
 * Main entry point for license validation and management.
 * Validation is now primarily server-based.
 * 
 * @module license/license-manager
 */

const { getHardwareId, getHardwareDetails } = require('./hardware-id');
const { validateLicenseKey } = require('./license-crypto');
const { licenseStorage } = require('./license-storage');
const serverClient = require('./license-server-client');

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
    SERVER_URL: 'http://127.0.0.1:3000',
    OFFLINE_TOLERANCE_HOURS: 24
};

// ============================================================================
// License Status Enum
// ============================================================================

const LicenseStatus = {
    VALID: 'valid',
    REVOKED: 'revoked',
    INVALID_KEY: 'invalid_key',
    KEY_ALREADY_USED: 'key_already_used',
    NOT_ACTIVATED: 'not_activated',
    OFFLINE_VALID: 'offline_valid',
    OFFLINE_EXPIRED: 'offline_expired',
    SERVER_ERROR: 'server_error'
};

// ============================================================================
// License Manager Class
// ============================================================================

class LicenseManager {
    constructor() {
        this.initialized = false;
        this.currentStatus = null;
        this.licenseData = null;
    }
    
    initialize(serverUrl = null) {
        if (this.initialized) return;
        
        try {
            licenseStorage.initialize();
            serverClient.setServerUrl(serverUrl || CONFIG.SERVER_URL);
            
            this.initialized = true;
            console.log('[License] Manager initialized');
        } catch (error) {
            console.error('[License] Initialization failed:', error);
            throw error;
        }
    }
    
    ensureInitialized() {
        if (!this.initialized) {
            this.initialize();
        }
    }
    
    setServerUrl(url) {
        CONFIG.SERVER_URL = url;
        serverClient.setServerUrl(url);
    }
    
    // ========================================================================
    // License Validation
    // ========================================================================
    
    async validateLicense() {
        this.ensureInitialized();
        
        const result = {
            status: LicenseStatus.NOT_ACTIVATED,
            message: '',
            hardwareId: getHardwareId(),
            online: false,
            license: null
        };
        
        // Check if we have local license data
        if (!licenseStorage.hasLicense()) {
            result.status = LicenseStatus.NOT_ACTIVATED;
            result.message = 'Silakan masukkan license key untuk mengaktifkan aplikasi.';
            return result;
        }
        
        // Load local data
        const localData = licenseStorage.loadLicenseData();
        if (!localData) {
            result.status = LicenseStatus.INVALID_KEY;
            result.message = 'Data lisensi rusak. Silakan aktivasi ulang.';
            licenseStorage.clearLicenseData();
            return result;
        }
        
        this.licenseData = localData;
        result.license = localData;
        
        // Validate with server
        try {
            const serverResult = await serverClient.validateLicense(result.hardwareId);
            
            if (serverResult.offline) {
                return this.handleOfflineValidation(result);
            }
            
            result.online = true;
            licenseStorage.saveServerCache(serverResult);
            
            if (serverResult.revoked) {
                result.status = LicenseStatus.REVOKED;
                result.message = serverResult.reason || 'Lisensi telah dinonaktifkan.';
                return result;
            }
            
            if (serverResult.valid) {
                result.status = LicenseStatus.VALID;
                result.message = 'Lisensi aktif.';
                return result;
            }
            
            if (!serverResult.activated) {
                result.status = LicenseStatus.NOT_ACTIVATED;
                result.message = 'Lisensi tidak ditemukan. Silakan aktivasi ulang.';
                licenseStorage.clearLicenseData();
                return result;
            }
            
            result.status = LicenseStatus.INVALID_KEY;
            result.message = 'Lisensi tidak valid.';
            return result;
            
        } catch (error) {
            console.error('[License] Server validation error:', error);
            return this.handleOfflineValidation(result);
        }
    }
    
    handleOfflineValidation(result) {
        const offlineStatus = licenseStorage.checkOfflineStatus(CONFIG.OFFLINE_TOLERANCE_HOURS);
        const cache = licenseStorage.loadServerCache();
        
        result.online = false;
        result.offlineHours = offlineStatus.hoursOffline;
        
        if (!offlineStatus.hasCache) {
            result.status = LicenseStatus.OFFLINE_EXPIRED;
            result.message = 'Hubungkan ke server untuk verifikasi pertama.';
            return result;
        }
        
        if (cache?.revoked) {
            result.status = LicenseStatus.REVOKED;
            result.message = cache.revokedReason || 'Lisensi telah dinonaktifkan.';
            return result;
        }
        
        if (offlineStatus.expired) {
            result.status = LicenseStatus.OFFLINE_EXPIRED;
            result.message = offlineStatus.message;
            return result;
        }
        
        result.status = LicenseStatus.OFFLINE_VALID;
        result.message = `Mode offline. ${offlineStatus.message}`;
        return result;
    }
    
    // ========================================================================
    // License Activation (Post-binding)
    // ========================================================================
    
    async activateLicense(licenseKey) {
        this.ensureInitialized();
        
        const result = {
            success: false,
            message: ''
        };
        
        // Basic format validation
        const keyValidation = validateLicenseKey(licenseKey);
        if (!keyValidation.valid) {
            result.message = keyValidation.error;
            return result;
        }
        
        const currentHwId = getHardwareId();
        
        // Server activation (this is where binding happens)
        try {
            const serverResult = await serverClient.activateLicense(
                licenseKey,
                currentHwId,
                this.getDeviceName()
            );
            
            if (!serverResult.success) {
                result.message = serverResult.message || 'Aktivasi gagal.';
                return result;
            }
            
            // Save locally
            licenseStorage.saveLicenseData({
                licenseKey: licenseKey.toUpperCase(),
                hardwareId: currentHwId,
                productCode: keyValidation.productCode
            });
            
            licenseStorage.saveServerCache({
                valid: true,
                revoked: false,
                serverTime: new Date().toISOString(),
                offlineToleranceHours: CONFIG.OFFLINE_TOLERANCE_HOURS
            });
            
            result.success = true;
            result.message = 'Lisensi berhasil diaktifkan!';
            
            console.log('[License] Activated:', currentHwId.substring(0, 8) + '...');
            return result;
            
        } catch (error) {
            console.error('[License] Activation error:', error);
            result.message = 'Tidak dapat terhubung ke server lisensi.';
            return result;
        }
    }
    
    deactivateLicense() {
        this.ensureInitialized();
        
        try {
            licenseStorage.clearLicenseData();
            this.licenseData = null;
            this.currentStatus = LicenseStatus.NOT_ACTIVATED;
            
            return { success: true, message: 'Lisensi berhasil dihapus dari perangkat ini.' };
        } catch (error) {
            console.error('[License] Deactivation error:', error);
            return { success: false, message: 'Gagal menghapus lisensi.' };
        }
    }
    
    // ========================================================================
    // Status Helpers
    // ========================================================================
    
    async isLicensed() {
        const validation = await this.validateLicense();
        
        return [
            LicenseStatus.VALID,
            LicenseStatus.OFFLINE_VALID
        ].includes(validation.status);
    }
    
    async getLicenseInfo() {
        this.ensureInitialized();
        
        // Always get hardware ID first - this should never fail
        let hardwareId = 'UNKNOWN';
        let hardwareDetails = {};
        
        try {
            hardwareId = getHardwareId();
            hardwareDetails = getHardwareDetails();
        } catch (error) {
            console.error('[License] Failed to get hardware ID:', error);
        }
        
        // Try validation, but don't let it fail the entire call
        let validation = {
            status: LicenseStatus.NOT_ACTIVATED,
            message: '',
            hardwareId: hardwareId
        };
        
        try {
            validation = await this.validateLicense();
        } catch (error) {
            console.error('[License] Validation error in getLicenseInfo:', error);
            validation.message = 'Tidak dapat memvalidasi lisensi';
        }
        
        return {
            ...validation,
            hardwareId: hardwareId,
            hardwareDetails,
            storagePath: licenseStorage.getStoragePath()
        };
    }
    
    getDeviceName() {
        const os = require('os');
        return os.hostname();
    }
    
    async getWarning() {
        try {
            const validation = await this.validateLicense();
            
            if (validation.status === LicenseStatus.OFFLINE_VALID) {
                return {
                    type: 'offline',
                    message: validation.message,
                    severity: 'warning'
                };
            }
        } catch (error) {
            console.error('[License] getWarning error:', error);
        }
        
        return null;
    }
}

// ============================================================================
// Export Singleton
// ============================================================================

const licenseManager = new LicenseManager();

module.exports = {
    licenseManager,
    LicenseManager,
    LicenseStatus,
    CONFIG
};
