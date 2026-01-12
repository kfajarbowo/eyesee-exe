#!/usr/bin/env node

/**
 * License Admin Tool
 * CLI tool for managing licenses - view, reset, delete for testing and admin.
 * 
 * Usage:
 *   node license-admin.js --status     # View current license status
 *   node license-admin.js --reset      # Reset/delete license
 *   node license-admin.js --hardware   # Show hardware ID
 *   node license-admin.js --path       # Show license storage path
 * 
 * @module tools/license-admin
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Get the license storage path
 * electron-store stores data in app's userData directory
 */
function getLicenseStoragePath() {
    // Possible app names (from package.json)
    const appNames = ['electron-webview', 'BMS Application', 'bms-exe', 'BMS'];
    const storeNames = ['bms-license', 'config'];
    
    const paths = [];
    
    for (const appName of appNames) {
        let configPath;
        switch (process.platform) {
            case 'win32':
                configPath = path.join(process.env.APPDATA || '', appName);
                break;
            case 'darwin':
                configPath = path.join(os.homedir(), 'Library', 'Application Support', appName);
                break;
            default: // linux
                configPath = path.join(os.homedir(), '.config', appName);
        }
        
        for (const storeName of storeNames) {
            paths.push({
                directory: configPath,
                licenseFile: path.join(configPath, `${storeName}.json`)
            });
        }
    }
    
    return paths;
}

/**
 * Find existing license file
 */
function findLicenseFile() {
    const allPaths = getLicenseStoragePath();
    
    for (const p of allPaths) {
        if (fs.existsSync(p.licenseFile)) {
            return p;
        }
    }
    
    // Return first path as default
    return allPaths[0];
}

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        status: false,
        reset: false,
        hardware: false,
        path: false,
        help: false,
        find: false
    };

    for (const arg of args) {
        switch (arg) {
            case '--status':
            case '-s':
                options.status = true;
                break;
            case '--reset':
            case '--delete':
            case '-r':
            case '-d':
                options.reset = true;
                break;
            case '--hardware':
            case '--hw':
                options.hardware = true;
                break;
            case '--path':
            case '-p':
                options.path = true;
                break;
            case '--find':
            case '-f':
                options.find = true;
                break;
            case '--help':
            case '-h':
            case '-?':
                options.help = true;
                break;
        }
    }

    // Default to status if no option specified
    if (!options.status && !options.reset && !options.hardware && !options.path && !options.help && !options.find) {
        options.status = true;
    }

    return options;
}

/**
 * Show help message
 */
function showHelp() {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    BMS License Admin Tool                        ║
╚══════════════════════════════════════════════════════════════════╝

Usage: node license-admin.js [options]

Options:
  -s, --status      View current license status (default)
  -r, --reset       Reset/delete license (for testing)
  --hardware        Show hardware ID
  -p, --path        Show license storage paths
  -f, --find        Find all license files
  -h, --help        Show this help message

Examples:
  # View license status
  node license-admin.js --status

  # Delete license for re-testing
  node license-admin.js --reset

  # Find all license files
  node license-admin.js --find
`);
}

/**
 * Find all license files
 */
function findAllLicenseFiles() {
    const allPaths = getLicenseStoragePath();
    
    console.log('\n🔍 Searching for license files:');
    console.log('─'.repeat(60));
    
    let found = 0;
    
    for (const p of allPaths) {
        const exists = fs.existsSync(p.licenseFile);
        const dirExists = fs.existsSync(p.directory);
        
        if (exists) {
            found++;
            const stats = fs.statSync(p.licenseFile);
            console.log(`\n✓ FOUND: ${p.licenseFile}`);
            console.log(`  Size: ${stats.size} bytes`);
            console.log(`  Modified: ${stats.mtime.toLocaleString()}`);
        } else if (dirExists) {
            // List all JSON files in directory
            try {
                const files = fs.readdirSync(p.directory).filter(f => f.endsWith('.json'));
                if (files.length > 0) {
                    console.log(`\n📁 Directory: ${p.directory}`);
                    console.log(`   JSON files found:`);
                    files.forEach(f => console.log(`   - ${f}`));
                }
            } catch (e) {
                // Ignore permission errors
            }
        }
    }
    
    if (found === 0) {
        console.log('\n✗ No license files found in expected locations.');
        console.log('\nSearched in:');
        const uniqueDirs = [...new Set(allPaths.map(p => p.directory))];
        uniqueDirs.forEach(d => console.log(`  ${d}`));
    }
    
    console.log('');
}

/**
 * Show license storage path
 */
function showPath() {
    const foundPath = findLicenseFile();
    
    console.log('\n📁 License Storage Paths:');
    console.log('─'.repeat(60));
    console.log(`Primary: ${foundPath.licenseFile}`);
    
    if (fs.existsSync(foundPath.licenseFile)) {
        const stats = fs.statSync(foundPath.licenseFile);
        console.log(`\n✓ File exists`);
        console.log(`  Size: ${stats.size} bytes`);
        console.log(`  Modified: ${stats.mtime.toLocaleString()}`);
    } else {
        console.log(`\n✗ License file not found`);
        console.log(`\nTip: Use --find to search all possible locations`);
    }
    console.log('');
}

/**
 * Show current license status
 */
function showStatus() {
    const foundPath = findLicenseFile();
    
    console.log('\n📋 License Status:');
    console.log('─'.repeat(60));
    
    if (!fs.existsSync(foundPath.licenseFile)) {
        console.log('Status: NOT ACTIVATED');
        console.log('No license file found.');
        console.log('\nTip: Use --find to search all possible locations');
        console.log('');
        return;
    }
    
    console.log(`File: ${foundPath.licenseFile}`);
    
    // Try using license-manager for proper decryption
    try {
        const { licenseManager } = require('../src/license');
        licenseManager.initialize();
        
        const info = licenseManager.getLicenseInfo();
        
        console.log('\nStatus: ' + info.status.toUpperCase());
        console.log(`Message: ${info.message}`);
        
        if (info.expiryDate) {
            console.log(`\n📅 Expiry: ${info.expiryDate.toLocaleDateString()}`);
        }
        
        if (info.daysUntilExpiry !== null) {
            const days = info.daysUntilExpiry;
            if (days > 0) {
                console.log(`⏳ Days Remaining: ${days} days`);
            } else if (days < 0) {
                console.log(`⚠️  Expired: ${Math.abs(days)} days ago`);
            }
        }
        
        if (info.gracePeriodRemaining !== null) {
            console.log(`🕐 Grace Period: ${info.gracePeriodRemaining} days remaining`);
        }
        
        console.log(`\n🔐 Hardware ID: ${info.hardwareId}`);
        
    } catch (error) {
        // Fallback: show raw file info
        console.log('\n⚠️  Cannot decrypt license data (running outside Electron)');
        console.log('   File exists and is encrypted (this is normal)');
        
        try {
            const stats = fs.statSync(foundPath.licenseFile);
            console.log(`\n   File Size: ${stats.size} bytes`);
            console.log(`   Modified: ${stats.mtime.toLocaleString()}`);
        } catch (e) {
            // Ignore
        }
        
        console.log('\n💡 To view full status, run the app or use Electron context.');
    }
    
    console.log('');
}

/**
 * Reset/delete license
 */
function resetLicense() {
    const foundPath = findLicenseFile();
    
    console.log('\n🗑️  Resetting License:');
    console.log('─'.repeat(60));
    
    if (!fs.existsSync(foundPath.licenseFile)) {
        console.log('No license file to delete.');
        console.log('\nTip: Use --find to search all possible locations');
        console.log('');
        return;
    }
    
    console.log(`File: ${foundPath.licenseFile}`);
    
    try {
        // Backup before delete
        const backupPath = foundPath.licenseFile + '.backup';
        fs.copyFileSync(foundPath.licenseFile, backupPath);
        console.log(`✓ Backup created: ${backupPath}`);
        
        // Delete license file
        fs.unlinkSync(foundPath.licenseFile);
        console.log('✓ License file deleted');
        
        console.log('\nLicense has been reset. Run the app to enter a new license.');
        
    } catch (error) {
        console.log(`✗ Error: ${error.message}`);
    }
    
    console.log('');
}

/**
 * Show hardware ID
 */
function showHardwareId() {
    console.log('\n🖥️  Hardware ID:');
    console.log('─'.repeat(50));
    
    try {
        // Try to import the hardware-id module
        const { getHardwareId, getHardwareDetails } = require('../src/license/hardware-id');
        
        const hardwareId = getHardwareId();
        const details = getHardwareDetails();
        
        console.log(`Hardware ID: ${hardwareId}`);
        console.log(`\nDetails:`);
        console.log(`  Platform: ${details.platform}`);
        console.log(`  Arch: ${details.arch}`);
        console.log(`  CPU: ${details.cpu}`);
        console.log(`  Hostname: ${details.hostname}`);
        console.log(`  Memory: ${details.memoryGB} GB`);
        
        console.log(`\n💡 Copy this Hardware ID to generate a license key.`);
        
    } catch (error) {
        console.log(`Error: ${error.message}`);
        console.log('\nNote: Run this from the project root directory.');
    }
    
    console.log('');
}

/**
 * Main function
 */
function main() {
    const options = parseArgs();
    
    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║                    BMS License Admin Tool                        ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    
    if (options.help) {
        showHelp();
        return;
    }
    
    if (options.path) {
        showPath();
    }
    
    if (options.find) {
        findAllLicenseFiles();
    }
    
    if (options.status) {
        showStatus();
    }
    
    if (options.hardware) {
        showHardwareId();
    }
    
    if (options.reset) {
        resetLicense();
    }
}

// Run
main();
