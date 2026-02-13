/**
 * Clear Specific License from SQLite Database
 * 
 * Run this to delete a license for specific hardware ID and product code
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_FILE = path.join(__dirname, '../data/licenses.db');

try {
    const db = new Database(DB_FILE);
    
    // Change these values to match your license
    const HARDWARE_ID = 'C28EC1428205FCFFCB2C2F2CD31FB94E1'; // Your hardware ID
    const PRODUCT_CODE = 'ES01'; // ES01, BM01, BL01, or VC01
    
    console.log('='.repeat(60));
    console.log('Deleting License from Database');
    console.log('='.repeat(60));
    console.log(`Hardware ID: ${HARDWARE_ID}`);
    console.log(`Product Code: ${PRODUCT_CODE}`);
    
    // Find the license first
    const findStmt = db.prepare('SELECT * FROM active_licenses WHERE hardware_id = ? AND product_code = ?');
    const license = findStmt.get(HARDWARE_ID, PRODUCT_CODE);
    
    if (!license) {
        console.log('\n❌ License not found in database');
        db.close();
        process.exit(1);
    }
    
    console.log(`\nFound license: ${license.license_key}`);
    
    // Delete the license
    const deleteStmt = db.prepare('DELETE FROM active_licenses WHERE hardware_id = ? AND product_code = ?');
    deleteStmt.run(HARDWARE_ID, PRODUCT_CODE);
    
    // Reset the generated key to unused
    const resetStmt = db.prepare(`
        UPDATE generated_keys 
        SET is_used = 0,
            used_at = NULL,
            activated_by_hardware_id = NULL
        WHERE license_key = ?
    `);
    resetStmt.run(license.license_key);
    
    console.log('✓ License deleted successfully');
    console.log('✓ Generated key reset to unused');
    console.log('='.repeat(60));
    
    db.close();
    
} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
