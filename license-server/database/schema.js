/**
 * SQLite Database Schema for License Server
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Database file location
const DB_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DB_DIR, 'licenses.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

// Initialize database
const db = new Database(DB_FILE);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

/**
 * Create tables
 */
function initializeDatabase() {
    console.log('[DB] Initializing SQLite database...');

    // Generated Keys Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS generated_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            license_key TEXT NOT NULL UNIQUE,
            product_code TEXT NOT NULL,
            is_used INTEGER DEFAULT 0,
            generated_at TEXT NOT NULL,
            used_at TEXT,
            activated_by_hardware_id TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            UNIQUE(license_key)
        );
    `);

    // Active Licenses Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS active_licenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            license_key TEXT NOT NULL,
            hardware_id TEXT NOT NULL,
            device_name TEXT,
            product_code TEXT NOT NULL,
            activated_at TEXT NOT NULL,
            last_check_at TEXT NOT NULL,
            is_revoked INTEGER DEFAULT 0,
            revoked_at TEXT,
            revoked_reason TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            UNIQUE(hardware_id, product_code)
        );
    `);

    // Indexes for better query performance
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_generated_keys_product 
        ON generated_keys(product_code);
        
        CREATE INDEX IF NOT EXISTS idx_generated_keys_used 
        ON generated_keys(is_used);
        
        CREATE INDEX IF NOT EXISTS idx_active_licenses_hardware 
        ON active_licenses(hardware_id);
        
        CREATE INDEX IF NOT EXISTS idx_active_licenses_product 
        ON active_licenses(product_code);
        
        CREATE INDEX IF NOT EXISTS idx_active_licenses_revoked 
        ON active_licenses(is_revoked);
    `);

    console.log('[DB] Database initialized successfully');
}

/**
 * Get database instance
 */
function getDatabase() {
    return db;
}

/**
 * Close database connection
 */
function closeDatabase() {
    db.close();
    console.log('[DB] Database connection closed');
}

module.exports = {
    initializeDatabase,
    getDatabase,
    closeDatabase,
    DB_FILE
};
