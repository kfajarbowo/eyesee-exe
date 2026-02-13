/**
 * Migration Script: JSON to SQLite
 * 
 * Migrates existing license data from database.json to SQLite
 */

const fs = require('fs');
const path = require('path');
const { initializeDatabase, getDatabase, closeDatabase } = require('./schema');

const JSON_FILE = path.join(__dirname, 'database.json');
const BACKUP_FILE = path.join(__dirname, 'database.json.backup');

function migrate() {
    console.log('='.repeat(60));
    console.log('License Server Migration: JSON → SQLite');
    console.log('='.repeat(60));

    // Initialize SQLite database
    initializeDatabase();
    const db = getDatabase();

    // Check if JSON file exists
    if (!fs.existsSync(JSON_FILE)) {
        console.log('[Migration] No JSON file found. Starting with empty database.');
        closeDatabase();
        return;
    }

    // Read JSON data
    console.log('[Migration] Reading data from database.json...');
    const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));

    // Migrate generated keys
    const generatedKeys = jsonData.generatedKeys || [];
    console.log(`[Migration] Migrating ${generatedKeys.length} generated keys...`);
    
    const insertKey = db.prepare(`
        INSERT OR IGNORE INTO generated_keys 
        (license_key, product_code, is_used, generated_at, used_at, activated_by_hardware_id)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertManyKeys = db.transaction((keys) => {
        for (const key of keys) {
            insertKey.run(
                key.license_key,
                key.product_code,
                key.is_used ? 1 : 0,
                key.generated_at || new Date().toISOString(),
                key.used_at || null,
                key.activated_by_hardware_id || null
            );
        }
    });

    insertManyKeys(generatedKeys);
    console.log(`[Migration] ✓ Migrated ${generatedKeys.length} generated keys`);

    // Migrate active licenses
    const licenses = jsonData.licenses || [];
    console.log(`[Migration] Migrating ${licenses.length} active licenses...`);
    
    const insertLicense = db.prepare(`
        INSERT OR IGNORE INTO active_licenses 
        (license_key, hardware_id, device_name, product_code, activated_at, last_check_at, is_revoked, revoked_at, revoked_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertManyLicenses = db.transaction((lics) => {
        for (const lic of lics) {
            insertLicense.run(
                lic.license_key,
                lic.hardware_id,
                lic.device_name || null,
                lic.product_code,
                lic.activated_at || new Date().toISOString(),
                lic.last_check_at || new Date().toISOString(),
                lic.is_revoked ? 1 : 0,
                lic.revoked_at || null,
                lic.revoked_reason || null
            );
        }
    });

    insertManyLicenses(licenses);
    console.log(`[Migration] ✓ Migrated ${licenses.length} active licenses`);

    // Create backup of JSON file
    console.log('[Migration] Creating backup of database.json...');
    fs.copyFileSync(JSON_FILE, BACKUP_FILE);
    console.log(`[Migration] ✓ Backup created: ${BACKUP_FILE}`);

    // Verify migration
    const keyCount = db.prepare('SELECT COUNT(*) as count FROM generated_keys').get().count;
    const licenseCount = db.prepare('SELECT COUNT(*) as count FROM active_licenses').get().count;
    
    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary:');
    console.log('='.repeat(60));
    console.log(`Generated Keys: ${keyCount} records`);
    console.log(`Active Licenses: ${licenseCount} records`);
    console.log('='.repeat(60));
    console.log('✓ Migration completed successfully!');
    console.log('='.repeat(60));

    closeDatabase();
}

// Run migration
if (require.main === module) {
    try {
        migrate();
        process.exit(0);
    } catch (error) {
        console.error('[Migration] ERROR:', error);
        process.exit(1);
    }
}

module.exports = { migrate };
