/**
 * Database Module (JSON-based)
 * 
 * Post-binding License System:
 * - generated_keys: Keys yang sudah di-generate (belum dipakai)
 * - licenses: Keys yang sudah ter-aktivasi dan ter-bind ke device
 * 
 * @module database/db
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.json');

// ============================================================================
// Core Database Operations
// ============================================================================

function read() {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { 
            generated_keys: [], 
            licenses: [] 
        };
    }
}

function write(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ============================================================================
// Generated Keys Repository
// Untuk track keys yang di-generate sebelum aktivasi
// ============================================================================

const generatedKeysRepo = {
    /**
     * Get all generated keys
     */
    getAll() {
        const db = read();
        return db.generated_keys || [];
    },

    /**
     * Get unused keys only
     */
    getUnused() {
        const db = read();
        return (db.generated_keys || []).filter(k => !k.is_used);
    },

    /**
     * Find key by license key string
     */
    findByKey(licenseKey) {
        const db = read();
        const normalizedKey = licenseKey.toUpperCase().trim();
        return (db.generated_keys || []).find(k => k.license_key === normalizedKey) || null;
    },

    /**
     * Add a new generated key
     */
    add(keyData) {
        const db = read();
        if (!db.generated_keys) db.generated_keys = [];
        
        const newKey = {
            license_key: keyData.license_key.toUpperCase(),
            product_code: keyData.product_code,
            generated_at: new Date().toISOString(),
            generated_by: keyData.generated_by || 'admin',
            is_used: false,
            used_by_hardware_id: null,
            used_at: null
        };
        
        db.generated_keys.push(newKey);
        write(db);
        return newKey;
    },

    /**
     * Add multiple keys at once
     */
    addBatch(keys) {
        const db = read();
        if (!db.generated_keys) db.generated_keys = [];
        
        const newKeys = keys.map(keyData => ({
            license_key: keyData.license_key.toUpperCase(),
            product_code: keyData.product_code,
            generated_at: new Date().toISOString(),
            generated_by: keyData.generated_by || 'admin',
            is_used: false,
            used_by_hardware_id: null,
            used_at: null
        }));
        
        db.generated_keys.push(...newKeys);
        write(db);
        return newKeys;
    },

    /**
     * Mark key as used (bound to hardware ID)
     */
    markUsed(licenseKey, hardwareId) {
        const db = read();
        const key = (db.generated_keys || []).find(
            k => k.license_key === licenseKey.toUpperCase()
        );
        
        if (key) {
            key.is_used = true;
            key.used_by_hardware_id = hardwareId.toUpperCase();
            key.used_at = new Date().toISOString();
            write(db);
            return true;
        }
        return false;
    },

    /**
     * Delete a key
     */
    delete(licenseKey) {
        const db = read();
        const initialLength = (db.generated_keys || []).length;
        db.generated_keys = (db.generated_keys || []).filter(
            k => k.license_key !== licenseKey.toUpperCase()
        );
        
        if (db.generated_keys.length < initialLength) {
            write(db);
            return true;
        }
        return false;
    },

    /**
     * Reset key to unused (for reactivation)
     */
    resetKeyToUnused(licenseKey) {
        const db = read();
        const key = (db.generated_keys || []).find(
            k => k.license_key === licenseKey.toUpperCase()
        );
        
        if (key) {
            key.is_used = false;
            key.used_by_hardware_id = null;
            key.used_at = null;
            write(db);
            return true;
        }
        return false;
    },

    /**
     * Get statistics
     */
    getStats() {
        const keys = this.getAll();
        return {
            total: keys.length,
            used: keys.filter(k => k.is_used).length,
            unused: keys.filter(k => !k.is_used).length
        };
    }
};

// ============================================================================
// License Repository
// Untuk track licenses yang sudah aktif
// ============================================================================

const licenseRepo = {
    /**
     * Get all licenses
     */
    getAll() {
        const db = read();
        return db.licenses || [];
    },

    /**
     * Find license by hardware ID
     */
    findByHardwareId(hardwareId) {
        const db = read();
        return (db.licenses || []).find(
            l => l.hardware_id === hardwareId.toUpperCase()
        ) || null;
    },

    /**
     * Find license by license key
     */
    findByKey(licenseKey) {
        const db = read();
        return (db.licenses || []).find(
            l => l.license_key === licenseKey.toUpperCase()
        ) || null;
    },

    /**
     * Create new license (when key is activated)
     */
    create(license) {
        const db = read();
        if (!db.licenses) db.licenses = [];
        
        const newLicense = {
            id: db.licenses.length + 1,
            license_key: license.license_key.toUpperCase(),
            hardware_id: license.hardware_id.toUpperCase(),
            device_name: license.device_name || null,
            product_code: license.product_code,
            activated_at: new Date().toISOString(),
            last_check_at: new Date().toISOString(),
            is_revoked: false,
            revoked_at: null,
            revoked_reason: null
        };
        
        db.licenses.push(newLicense);
        write(db);
        return newLicense;
    },

    /**
     * Update license
     */
    update(hardwareId, updates) {
        const db = read();
        const index = (db.licenses || []).findIndex(
            l => l.hardware_id === hardwareId.toUpperCase()
        );
        
        if (index === -1) return null;
        
        db.licenses[index] = { ...db.licenses[index], ...updates };
        write(db);
        return db.licenses[index];
    },

    /**
     * Update last check time
     */
    updateLastCheck(hardwareId) {
        this.update(hardwareId, { last_check_at: new Date().toISOString() });
    },

    /**
     * Revoke license
     */
    revoke(hardwareId, reason = 'Revoked by admin') {
        return this.update(hardwareId, {
            is_revoked: true,
            revoked_at: new Date().toISOString(),
            revoked_reason: reason
        });
    },

    /**
     * Reactivate revoked license
     */
    reactivate(hardwareId) {
        return this.update(hardwareId, {
            is_revoked: false,
            revoked_at: null,
            revoked_reason: null
        });
    },

    /**
     * Delete license
     */
    delete(hardwareId) {
        const db = read();
        const initialLength = (db.licenses || []).length;
        db.licenses = (db.licenses || []).filter(
            l => l.hardware_id !== hardwareId.toUpperCase()
        );
        
        if (db.licenses.length < initialLength) {
            write(db);
            return true;
        }
        return false;
    },

    /**
     * Get statistics
     */
    getStats() {
        const licenses = this.getAll();
        const byProduct = {};
        
        licenses.forEach(l => {
            const pc = l.product_code || 'UNKNOWN';
            byProduct[pc] = (byProduct[pc] || 0) + 1;
        });
        
        return {
            total: licenses.length,
            active: licenses.filter(l => !l.is_revoked).length,
            revoked: licenses.filter(l => l.is_revoked).length,
            byProduct
        };
    }
};

// ============================================================================
// Exports
// ============================================================================

module.exports = {
    licenseRepo,
    generatedKeysRepo,
    _read: read,
    _write: write
};
