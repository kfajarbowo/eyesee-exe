/**
 * Hardware ID Module
 * Generates a unique, persistent hardware fingerprint for license binding.
 * 
 * Uses multiple hardware identifiers to create a stable ID that persists
 * across reboots and minor hardware changes.
 * 
 * @module license/hardware-id
 */

const { machineIdSync } = require('node-machine-id');
const crypto = require('crypto');
const os = require('os');

/**
 * Configuration for hardware ID generation
 */
const CONFIG = {
    // Salt for additional security (change this for your deployment)
    SALT: 'eyesee-license-v1',
    // Hash algorithm
    ALGORITHM: 'sha256',
    // Output length (characters)
    OUTPUT_LENGTH: 32
};

/**
 * Get machine ID from node-machine-id
 * This is the primary identifier, based on:
 * - Windows: MachineGuid from registry
 * - macOS: IOPlatformUUID
 * - Linux: /var/lib/dbus/machine-id
 * 
 * @returns {string} Machine ID or empty string if unavailable
 */
function getMachineId() {
    try {
        return machineIdSync({ original: true });
    } catch (error) {
        console.warn('Failed to get machine ID:', error.message);
        return '';
    }
}

/**
 * Get CPU information as a fallback identifier
 * 
 * @returns {string} CPU model string
 */
function getCpuId() {
    try {
        const cpus = os.cpus();
        if (cpus && cpus.length > 0) {
            return cpus[0].model;
        }
        return '';
    } catch (error) {
        console.warn('Failed to get CPU ID:', error.message);
        return '';
    }
}

/**
 * Get hostname as additional identifier
 * 
 * @returns {string} Hostname
 */
function getHostname() {
    try {
        return os.hostname();
    } catch (error) {
        console.warn('Failed to get hostname:', error.message);
        return '';
    }
}

/**
 * Get total memory as additional identifier
 * Note: This may change if user adds/removes RAM
 * 
 * @returns {string} Total memory in GB (rounded)
 */
function getTotalMemory() {
    try {
        const totalMem = os.totalmem();
        // Round to nearest GB to allow for slight variations
        const memGB = Math.round(totalMem / (1024 * 1024 * 1024));
        return memGB.toString();
    } catch (error) {
        console.warn('Failed to get memory:', error.message);
        return '';
    }
}

/**
 * Generate a unique hardware fingerprint
 * Combines multiple identifiers for a stable, unique ID
 * 
 * @returns {string} 32-character hardware ID
 */
function generateHardwareId() {
    // Collect all hardware identifiers
    const identifiers = [
        getMachineId(),
        getCpuId(),
        getHostname(),
        getTotalMemory()
    ];

    // Combine identifiers with salt
    const combined = identifiers.join('|') + '|' + CONFIG.SALT;

    // Generate hash
    const hash = crypto
        .createHash(CONFIG.ALGORITHM)
        .update(combined)
        .digest('hex');

    // Return truncated hash
    return hash.substring(0, CONFIG.OUTPUT_LENGTH).toUpperCase();
}

/**
 * Get the hardware ID (cached for performance)
 * 
 * @returns {string} Hardware ID
 */
let cachedHardwareId = null;

function getHardwareId() {
    if (cachedHardwareId === null) {
        cachedHardwareId = generateHardwareId();
    }
    return cachedHardwareId;
}

/**
 * Clear the cached hardware ID
 * Useful for testing or if hardware changes are detected
 */
function clearCache() {
    cachedHardwareId = null;
}

/**
 * Get detailed hardware information (for debugging/support)
 * 
 * @returns {Object} Hardware details
 */
function getHardwareDetails() {
    return {
        hardwareId: getHardwareId(),
        machineId: getMachineId() ? '***' + getMachineId().slice(-8) : 'N/A',
        cpu: getCpuId(),
        hostname: getHostname(),
        memoryGB: getTotalMemory(),
        platform: os.platform(),
        arch: os.arch()
    };
}

module.exports = {
    getHardwareId,
    getHardwareDetails,
    clearCache,
    // Export for testing
    _internal: {
        getMachineId,
        getCpuId,
        getHostname,
        getTotalMemory,
        generateHardwareId
    }
};
