/**
 * License Manager Module
 * Main entry point for license validation and management.
 * 
 * Features:
 * - License key validation with expiry checking
 * - Hardware binding (pre-binding - Hardware ID embedded in key)
 * - Clock manipulation detection
 * - Grace period handling (7 days)
 * - Expiry reminders (30, 14, 7 days)
 * 
 * @module license/license-manager
 */

const { getHardwareId, getHardwareDetails } = require('./hardware-id');
const { validateLicenseKey } = require('./license-crypto');
const { licenseStorage } = require('./license-storage');

/**
 * Configuration
 */
const CONFIG = {
    // Grace period after expiry (in days)
    GRACE_PERIOD_DAYS: 7,
    
    // Reminder periods before expiry (in days)
    REMINDER_DAYS: [30, 14, 7],
    
    // Clock manipulation tolerance (1 hour in ms)
    CLOCK_TOLERANCE_MS: 3600000
};

/**
 * License status enumeration
 */
const LicenseStatus = {
    VALID: 'valid',
    EXPIRED: 'expired',
    GRACE_PERIOD: 'grace_period',
    INVALID_KEY: 'invalid_key',
    HARDWARE_MISMATCH: 'hardware_mismatch',
    CLOCK_MANIPULATED: 'clock_manipulated',
    NOT_ACTIVATED: 'not_activated'
};

/**
 * License Manager class
 * Handles all license operations
 */
class LicenseManager {
    constructor() {
        this.initialized = false;
        this.currentStatus = null;
        this.licenseData = null;
    }

    /**
     * Initialize the license manager
     */
    initialize() {
        if (this.initialized) {
            return;
        }

        try {
            licenseStorage.initialize();
            this.initialized = true;
            console.log('License manager initialized');
        } catch (error) {
            console.error('Failed to initialize license manager:', error);
            throw error;
        }
    }

    /**
     * Ensure manager is initialized
     */
    ensureInitialized() {
        if (!this.initialized) {
            this.initialize();
        }
    }

    /**
     * Calculate days until expiry
     * 
     * @param {Date} expiryDate - Expiry date
     * @returns {number} Days until expiry (negative if expired)
     */
    getDaysUntilExpiry(expiryDate) {
        const now = new Date();
        const diffMs = expiryDate.getTime() - now.getTime();
        return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }

    /**
     * Check if currently in grace period
     * 
     * @param {Date} expiryDate - Expiry date
     * @returns {boolean} True if in grace period
     */
    isInGracePeriod(expiryDate) {
        const daysUntilExpiry = this.getDaysUntilExpiry(expiryDate);
        return daysUntilExpiry < 0 && daysUntilExpiry >= -CONFIG.GRACE_PERIOD_DAYS;
    }

    /**
     * Get active reminder level (if any)
     * 
     * @param {Date} expiryDate - Expiry date
     * @returns {number|null} Days until expiry if within reminder period, null otherwise
     */
    getActiveReminder(expiryDate) {
        const daysUntilExpiry = this.getDaysUntilExpiry(expiryDate);
        
        for (const reminderDays of CONFIG.REMINDER_DAYS) {
            if (daysUntilExpiry <= reminderDays && daysUntilExpiry > 0) {
                return daysUntilExpiry;
            }
        }
        
        return null;
    }

    /**
     * Validate the current license
     * 
     * @returns {Object} Validation result
     */
    validateLicense() {
        this.ensureInitialized();

        const result = {
            status: LicenseStatus.NOT_ACTIVATED,
            message: '',
            expiryDate: null,
            daysUntilExpiry: null,
            reminderDays: null,
            hardwareId: getHardwareId(),
            gracePeriodRemaining: null
        };

        // Check for clock manipulation
        const clockCheck = licenseStorage.checkClockManipulation(CONFIG.CLOCK_TOLERANCE_MS);
        if (clockCheck.manipulated) {
            result.status = LicenseStatus.CLOCK_MANIPULATED;
            result.message = 'Waktu sistem terdeteksi tidak valid. Pastikan tanggal dan waktu komputer Anda benar.';
            return result;
        }

        // Update last check time
        licenseStorage.updateLastCheckTime();

        // Check if license exists
        if (!licenseStorage.hasLicense()) {
            result.status = LicenseStatus.NOT_ACTIVATED;
            result.message = 'Silakan masukkan license key untuk mengaktifkan aplikasi.';
            return result;
        }

        // Load license data
        const licenseData = licenseStorage.loadLicenseData();
        if (!licenseData) {
            result.status = LicenseStatus.INVALID_KEY;
            result.message = 'Data lisensi rusak. Silakan masukkan ulang license key.';
            licenseStorage.clearLicenseData();
            return result;
        }

        this.licenseData = licenseData;

        // Check hardware binding
        const currentHardwareId = getHardwareId();
        if (licenseData.hardwareId !== currentHardwareId) {
            result.status = LicenseStatus.HARDWARE_MISMATCH;
            result.message = 'Lisensi ini terdaftar untuk perangkat lain.';
            result.hardwareId = currentHardwareId;
            return result;
        }

        // Check expiry
        const daysUntilExpiry = this.getDaysUntilExpiry(licenseData.expiryDate);
        result.expiryDate = licenseData.expiryDate;
        result.daysUntilExpiry = daysUntilExpiry;

        if (daysUntilExpiry < 0) {
            // Expired - check grace period
            if (this.isInGracePeriod(licenseData.expiryDate)) {
                const graceDaysRemaining = CONFIG.GRACE_PERIOD_DAYS + daysUntilExpiry;
                result.status = LicenseStatus.GRACE_PERIOD;
                result.gracePeriodRemaining = graceDaysRemaining;
                result.message = `Lisensi sudah dalam masa tenggang: ${graceDaysRemaining} hari. Segera perpanjang lisensi.`;
            } else {
                result.status = LicenseStatus.EXPIRED;
                result.message = 'Lisensi sudah expired dan masa tenggang telah berakhir.';
            }
        } else {
            // Valid - check for reminders
            result.status = LicenseStatus.VALID;
            result.reminderDays = this.getActiveReminder(licenseData.expiryDate);
            
            if (result.reminderDays !== null) {
                result.message = `Lisensi akan expired dalam ${result.reminderDays} hari.`;
            } else {
                result.message = 'Lisensi aktif.';
            }
        }

        this.currentStatus = result.status;
        return result;
    }

    /**
     * Activate a new license
     * 
     * @param {string} licenseKey - License key to activate
     * @returns {Object} Activation result
     */
    activateLicense(licenseKey) {
        this.ensureInitialized();

        const result = {
            success: false,
            message: '',
            expiryDate: null
        };

        // Validate the license key format and extract expiry + hardware ID
        const validation = validateLicenseKey(licenseKey);
        
        if (!validation.valid) {
            result.message = validation.error || 'License key tidak valid.';
            return result;
        }

        // Check if not already expired
        const daysUntilExpiry = this.getDaysUntilExpiry(validation.expiryDate);
        if (daysUntilExpiry < -CONFIG.GRACE_PERIOD_DAYS) {
            result.message = 'License key ini sudah expired.';
            return result;
        }

        // Get current hardware ID
        const currentHardwareId = getHardwareId();
        
        // PRE-BINDING CHECK: Verify embedded Hardware ID matches current device
        const embeddedHwId = validation.hardwareId; // First 8 chars of HW ID from key
        const currentHwIdPrefix = currentHardwareId.substring(0, 8).toUpperCase();
        
        if (embeddedHwId !== currentHwIdPrefix) {
            result.message = 'License key ini tidak terdaftar untuk perangkat ini.\n\nPastikan key yang dimasukkan sesuai dengan Hardware ID perangkat Anda.';
            console.log('Hardware mismatch:', {
                embedded: embeddedHwId,
                current: currentHwIdPrefix
            });
            return result;
        }

        // Save license data
        try {
            licenseStorage.saveLicenseData({
                licenseKey: licenseKey.toUpperCase(),
                expiryDate: validation.expiryDate,
                hardwareId: currentHardwareId
            });

            result.success = true;
            result.message = 'Lisensi berhasil diaktifkan!';
            result.expiryDate = validation.expiryDate;

            console.log('License activated:', {
                expiry: validation.expiryDate.toISOString(),
                hardwareId: currentHardwareId.substring(0, 8) + '...'
            });
        } catch (error) {
            console.error('Failed to save license:', error);
            result.message = 'Gagal menyimpan data lisensi. Silakan coba lagi.';
        }

        return result;
    }

    /**
     * Deactivate (remove) the current license
     * 
     * @returns {Object} Deactivation result
     */
    deactivateLicense() {
        this.ensureInitialized();

        try {
            licenseStorage.clearLicenseData();
            this.licenseData = null;
            this.currentStatus = LicenseStatus.NOT_ACTIVATED;

            return {
                success: true,
                message: 'Lisensi berhasil dihapus.'
            };
        } catch (error) {
            console.error('Failed to deactivate license:', error);
            return {
                success: false,
                message: 'Gagal menghapus lisensi.'
            };
        }
    }

    /**
     * Get license information (for display)
     * 
     * @returns {Object} License info
     */
    getLicenseInfo() {
        this.ensureInitialized();

        const validation = this.validateLicense();
        const hardwareDetails = getHardwareDetails();

        return {
            ...validation,
            hardwareDetails,
            storagePath: licenseStorage.getStoragePath()
        };
    }

    /**
     * Check if app should run (is licensed)
     * 
     * @returns {boolean} True if app is allowed to run
     */
    isLicensed() {
        const validation = this.validateLicense();
        return [
            LicenseStatus.VALID,
            LicenseStatus.GRACE_PERIOD
        ].includes(validation.status);
    }

    /**
     * Check if reminder should be shown
     * 
     * @returns {Object|null} Reminder info or null
     */
    getReminder() {
        const validation = this.validateLicense();

        if (validation.status === LicenseStatus.GRACE_PERIOD) {
            return {
                type: 'grace_period',
                message: validation.message,
                daysRemaining: validation.gracePeriodRemaining,
                severity: 'critical'
            };
        }

        if (validation.reminderDays !== null) {
            let severity = 'info';
            if (validation.reminderDays <= 7) severity = 'warning';
            if (validation.reminderDays <= 3) severity = 'critical';

            return {
                type: 'expiry_reminder',
                message: validation.message,
                daysRemaining: validation.reminderDays,
                severity
            };
        }

        return null;
    }
}

// Export singleton instance and classes
const licenseManager = new LicenseManager();

module.exports = {
    licenseManager,
    LicenseManager,
    LicenseStatus,
    CONFIG: {
        GRACE_PERIOD_DAYS: CONFIG.GRACE_PERIOD_DAYS,
        REMINDER_DAYS: CONFIG.REMINDER_DAYS
    }
};
