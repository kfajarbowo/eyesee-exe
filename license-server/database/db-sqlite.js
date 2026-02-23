/**
 * SQLite Database Repository
 * Replaces JSON-based storage with SQLite
 */

const { getDatabase } = require('./schema');

// ============================================================================
// Generated Keys Repository
// ============================================================================

const generatedKeysRepo = {
    /**
     * Add a new generated key
     */
    add(keyData) {
        const db = getDatabase();
        const stmt = db.prepare(`
            INSERT INTO generated_keys (license_key, product_code, generated_at)
            VALUES (?, ?, ?)
        `);
        
        const result = stmt.run(
            keyData.license_key,
            keyData.product_code,
            new Date().toISOString()
        );
        
        return this.findByKey(keyData.license_key);
    },

    /**
     * Find key by license key string
     */
    findByKey(licenseKey) {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM generated_keys WHERE license_key = ?');
        const row = stmt.get(licenseKey);
        
        if (!row) return null;
        
        return {
            id: row.id,
            license_key: row.license_key,
            product_code: row.product_code,
            is_used: Boolean(row.is_used),
            generated_at: row.generated_at,
            used_at: row.used_at,
            activated_by_hardware_id: row.activated_by_hardware_id
        };
    },

    /**
     * Mark key as used
     */
    markAsUsed(licenseKey, hardwareId) {
        const db = getDatabase();
        const stmt = db.prepare(`
            UPDATE generated_keys 
            SET is_used = 1, 
                used_at = ?, 
                activated_by_hardware_id = ?
            WHERE license_key = ?
        `);
        
        stmt.run(new Date().toISOString(), hardwareId, licenseKey);
    },

    /**
     * Alias for backward compatibility
     */
    markUsed(licenseKey, hardwareId) {
        return this.markAsUsed(licenseKey, hardwareId);
    },

    /**
     * Get all generated keys
     */
    getAll() {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM generated_keys ORDER BY generated_at DESC');
        const rows = stmt.all();
        
        return rows.map(row => ({
            id: row.id,
            license_key: row.license_key,
            product_code: row.product_code,
            is_used: Boolean(row.is_used),
            generated_at: row.generated_at,
            used_at: row.used_at,
            activated_by_hardware_id: row.activated_by_hardware_id
        }));
    },

    /**
     * Reset key to unused (allow reactivation)
     */
    resetKeyToUnused(licenseKey) {
        const db = getDatabase();
        const stmt = db.prepare(`
            UPDATE generated_keys 
            SET is_used = 0,
                used_at = NULL,
                activated_by_hardware_id = NULL
            WHERE license_key = ?
        `);
        
        stmt.run(licenseKey);
    },

    /**
     * Delete a key
     */
    deleteByKey(licenseKey) {
        const db = getDatabase();
        const stmt = db.prepare('DELETE FROM generated_keys WHERE license_key = ?');
        stmt.run(licenseKey);
    },

    /**
     * Get statistics
     */
    getStats() {
        const db = getDatabase();
        
        const total = db.prepare('SELECT COUNT(*) as count FROM generated_keys').get().count;
        const used = db.prepare('SELECT COUNT(*) as count FROM generated_keys WHERE is_used = 1').get().count;
        const unused = total - used;
        
        const byProduct = {};
        const products = db.prepare('SELECT product_code, COUNT(*) as count FROM generated_keys GROUP BY product_code').all();
        
        products.forEach(p => {
            byProduct[p.product_code] = p.count;
        });
        
        return { total, used, unused, byProduct };
    }
};

// ============================================================================
// Active Licenses Repository
// ============================================================================

const licenseRepo = {
    /**
     * Add new active license
     */
    add(licenseData) {
        const db = getDatabase();
        const stmt = db.prepare(`
            INSERT INTO active_licenses 
            (license_key, hardware_id, device_name, product_code, activated_at, last_check_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        const now = new Date().toISOString();
        stmt.run(
            licenseData.license_key,
            licenseData.hardware_id,
            licenseData.device_name || null,
            licenseData.product_code,
            now,
            now
        );
        
        return this.findByHardwareId(licenseData.hardware_id);
    },

    /**
     * Alias for backward compatibility
     */
    create(licenseData) {
        return this.add(licenseData);
    },

    /**
     * Find license by hardware ID (returns first match)
     */
    findByHardwareId(hardwareId) {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM active_licenses WHERE hardware_id = ? LIMIT 1');
        const row = stmt.get(hardwareId);
        
        if (!row) return null;
        
        return {
            id: row.id,
            license_key: row.license_key,
            hardware_id: row.hardware_id,
            device_name: row.device_name,
            product_code: row.product_code,
            activated_at: row.activated_at,
            last_check_at: row.last_check_at,
            is_revoked: Boolean(row.is_revoked),
            revoked_at: row.revoked_at,
            revoked_reason: row.revoked_reason
        };
    },

    /**
     * Find license by hardware ID and product code
     */
    findByHardwareAndProduct(hardwareId, productCode) {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM active_licenses WHERE hardware_id = ? AND product_code = ?');
        const row = stmt.get(hardwareId, productCode);
        
        if (!row) return null;
        
        return {
            id: row.id,
            license_key: row.license_key,
            hardware_id: row.hardware_id,
            device_name: row.device_name,
            product_code: row.product_code,
            activated_at: row.activated_at,
            last_check_at: row.last_check_at,
            is_revoked: Boolean(row.is_revoked),
            revoked_at: row.revoked_at,
            revoked_reason: row.revoked_reason
        };
    },

    /**
     * Update last check timestamp
     */
    updateLastCheck(hardwareId) {
        const db = getDatabase();
        const stmt = db.prepare(`
            UPDATE active_licenses 
            SET last_check_at = ?,
                updated_at = ?
            WHERE hardware_id = ?
        `);
        
        const now = new Date().toISOString();
        stmt.run(now, now, hardwareId);
        
        // Return updated license
        return this.findByHardwareId(hardwareId);
    },

    /**
     * Revoke a license
     */
    revoke(hardwareId, reason) {
        const db = getDatabase();
        const stmt = db.prepare(`
            UPDATE active_licenses 
            SET is_revoked = 1,
                revoked_at = ?,
                revoked_reason = ?,
                updated_at = ?
            WHERE hardware_id = ?
        `);
        
        const now = new Date().toISOString();
        stmt.run(now, reason, now, hardwareId);
        
        // Return updated license
        return this.findByHardwareId(hardwareId);
    },

    /**
     * Reactivate a revoked license
     */
    reactivate(hardwareId) {
        const db = getDatabase();
        const stmt = db.prepare(`
            UPDATE active_licenses 
            SET is_revoked = 0,
                revoked_at = NULL,
                revoked_reason = NULL,
                updated_at = ?
            WHERE hardware_id = ?
        `);
        
        stmt.run(new Date().toISOString(), hardwareId);
        
        // Return updated license
        return this.findByHardwareId(hardwareId);
    },



    /**
     * Delete a license by hardware ID only (hapus semua produk)
     */
    deleteByHardwareId(hardwareId) {
        const db = getDatabase();
        const stmt = db.prepare('DELETE FROM active_licenses WHERE hardware_id = ?');
        stmt.run(hardwareId);
    },

    /**
     * Delete license untuk produk tertentu saja
     */
    deleteByHardwareIdAndProduct(hardwareId, productCode) {
        const db = getDatabase();
        const stmt = db.prepare('DELETE FROM active_licenses WHERE hardware_id = ? AND product_code = ?');
        const result = stmt.run(hardwareId, productCode);
        return result.changes > 0;
    },

    /**
     * Find license by hardware ID + product code
     */
    findByHardwareIdAndProduct(hardwareId, productCode) {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM active_licenses WHERE hardware_id = ? AND product_code = ?');
        const row = stmt.get(hardwareId, productCode);
        if (!row) return null;
        return {
            id: row.id,
            license_key: row.license_key,
            hardware_id: row.hardware_id,
            device_name: row.device_name,
            product_code: row.product_code,
            activated_at: row.activated_at,
            last_check_at: row.last_check_at,
            is_revoked: Boolean(row.is_revoked),
            revoked_at: row.revoked_at,
            revoked_reason: row.revoked_reason
        };
    },

    /**
     * Alias for backward compatibility
     */
    delete(hardwareId) {
        return this.deleteByHardwareId(hardwareId);
    },

    /**
     * Get all licenses
     */
    getAll() {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM active_licenses ORDER BY activated_at DESC');
        const rows = stmt.all();
        
        return rows.map(row => ({
            id: row.id,
            license_key: row.license_key,
            hardware_id: row.hardware_id,
            device_name: row.device_name,
            product_code: row.product_code,
            activated_at: row.activated_at,
            last_check_at: row.last_check_at,
            is_revoked: Boolean(row.is_revoked),
            revoked_at: row.revoked_at,
            revoked_reason: row.revoked_reason
        }));
    },

    /**
     * Get statistics
     */
    getStats() {
        const db = getDatabase();
        
        const total = db.prepare('SELECT COUNT(*) as count FROM active_licenses').get().count;
        const active = db.prepare('SELECT COUNT(*) as count FROM active_licenses WHERE is_revoked = 0').get().count;
        const revoked = total - active;
        
        const byProduct = {};
        const products = db.prepare('SELECT product_code, COUNT(*) as count FROM active_licenses WHERE is_revoked = 0 GROUP BY product_code').all();
        
        products.forEach(p => {
            byProduct[p.product_code] = p.count;
        });
        
        return { total, active, revoked, byProduct };
    }
};

// ============================================================================
// Admin Users Repository
// ============================================================================

const adminUsersRepo = {
    /**
     * Create admin user
     */
    create(username, passwordHash, role = 'admin') {
        const db = getDatabase();
        const stmt = db.prepare(
            'INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)'
        );
        const result = stmt.run(username, passwordHash, role);
        return this.findById(result.lastInsertRowid);
    },

    /**
     * Find by username
     */
    findByUsername(username) {
        const db = getDatabase();
        return db.prepare('SELECT * FROM admin_users WHERE username = ? AND is_active = 1').get(username);
    },

    /**
     * Find by ID
     */
    findById(id) {
        const db = getDatabase();
        return db.prepare('SELECT id, username, role, is_active, created_at, last_login_at FROM admin_users WHERE id = ?').get(id);
    },

    /**
     * Get all users (no password hash)
     */
    getAll() {
        const db = getDatabase();
        return db.prepare('SELECT id, username, role, is_active, created_at, last_login_at FROM admin_users ORDER BY created_at DESC').all();
    },

    /**
     * Update last login time
     */
    updateLastLogin(username) {
        const db = getDatabase();
        db.prepare("UPDATE admin_users SET last_login_at = datetime('now') WHERE username = ?").run(username);
    },

    /**
     * Update password
     */
    updatePassword(username, newPasswordHash) {
        const db = getDatabase();
        db.prepare('UPDATE admin_users SET password_hash = ? WHERE username = ?').run(newPasswordHash, username);
    },

    /**
     * Deactivate user
     */
    deactivate(username) {
        const db = getDatabase();
        db.prepare('UPDATE admin_users SET is_active = 0 WHERE username = ?').run(username);
    },

    /**
     * Check if any admin user exists
     */
    hasAnyUser() {
        const db = getDatabase();
        const row = db.prepare('SELECT COUNT(*) as count FROM admin_users WHERE is_active = 1').get();
        return row.count > 0;
    }
};

module.exports = {
    generatedKeysRepo,
    licenseRepo,
    adminUsersRepo
};
