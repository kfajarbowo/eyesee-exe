#!/usr/bin/env node

/**
 * License Key Generator Tool (Pre-binding)
 * CLI tool for generating license keys for EyeSee application.
 * 
 * Each key is bound to a specific Hardware ID.
 * 
 * Usage:
 *   node license-generator.js --hardware ABC123... --expiry 2026-12-31
 *   node license-generator.js --batch hardware_ids.csv --expiry 2026-12-31 --output licenses.csv
 * 
 * @module tools/license-generator
 */

const fs = require('fs');
const path = require('path');

// Import crypto module from license system
const licenseCrypto = require('../src/license/license-crypto');

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        expiry: null,
        hardware: null,
        batch: null,
        output: null,
        help: false
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--expiry':
            case '-e':
                options.expiry = args[++i];
                break;
            case '--hardware':
            case '--hw':
                options.hardware = args[++i];
                break;
            case '--batch':
            case '-b':
                options.batch = args[++i];
                break;
            case '--output':
            case '-o':
                options.output = args[++i];
                break;
            case '--help':
            case '-h':
                options.help = true;
                break;
        }
    }

    return options;
}

/**
 * Show help message
 */
function showHelp() {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║              EyeSee License Generator (Pre-binding)              ║
╚══════════════════════════════════════════════════════════════════╝

Usage: node license-generator.js [options]

Options:
  --hw, --hardware <id>  Hardware ID to bind (32 chars, required for single)
  -e, --expiry <date>    Expiry date YYYY-MM-DD (required)
  -b, --batch <file>     CSV file with hardware IDs (for batch generation)
  -o, --output <file>    Output CSV file path
  -h, --help             Show this help message

SINGLE KEY:
  node license-generator.js --hardware C20EC14202D5FCFF --expiry 2026-12-31

BATCH (from CSV):
  node license-generator.js --batch hardware_ids.csv --expiry 2026-12-31 --output licenses.csv

CSV Format for --batch:
  HARDWARE_ID,DEVICE_NAME
  C20EC14202D5FCFF...,Laptop-001
  A1B2C3D4E5F6...,PC-Admin

Format Key: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX (6 segments)
`);
}

/**
 * Format date for display
 */
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

/**
 * Generate single license
 */
function generateLicense(hardwareId, expiryDate) {
    const key = licenseCrypto.generateLicenseKey(expiryDate, hardwareId);
    return {
        key,
        hardwareId: hardwareId.substring(0, 8).toUpperCase(),
        hardwareIdFull: hardwareId.toUpperCase(),
        expiryDate: formatDate(expiryDate),
        createdAt: formatDate(new Date()),
        status: 'generated'
    };
}

/**
 * Read batch file (CSV with HARDWARE_ID column)
 */
function readBatchFile(filepath) {
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.trim().split('\n');
    
    const devices = [];
    let hasHeader = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(',').map(p => p.trim());
        
        // Check if first line is header
        if (i === 0 && parts[0].toUpperCase().includes('HARDWARE')) {
            hasHeader = true;
            continue;
        }
        
        const hardwareId = parts[0];
        const deviceName = parts[1] || `Device-${devices.length + 1}`;
        
        if (hardwareId && hardwareId.length >= 8) {
            devices.push({ hardwareId, deviceName });
        }
    }
    
    return devices;
}

/**
 * Export licenses to CSV
 */
function exportToCSV(licenses, filepath) {
    const headers = ['LICENSE_KEY', 'HARDWARE_ID', 'DEVICE_NAME', 'EXPIRY_DATE', 'CREATED_AT', 'STATUS'];
    const rows = licenses.map(l => [
        l.key,
        l.hardwareIdFull || l.hardwareId,
        l.deviceName || '',
        l.expiryDate,
        l.createdAt,
        l.status
    ]);
    
    const csv = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');
    
    fs.writeFileSync(filepath, csv, 'utf8');
    return filepath;
}

/**
 * Main function
 */
function main() {
    const options = parseArgs();
    
    // Show help
    if (options.help) {
        showHelp();
        process.exit(0);
    }
    
    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║              EyeSee License Generator (Pre-binding)              ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');
    
    // Validate expiry date
    if (!options.expiry) {
        console.error('Error: Expiry date is required. Use --expiry YYYY-MM-DD');
        console.error('Use --help for more information.');
        process.exit(1);
    }
    
    const expiryDate = new Date(options.expiry);
    if (isNaN(expiryDate.getTime())) {
        console.error('Error: Invalid date format. Use YYYY-MM-DD');
        process.exit(1);
    }
    
    // Check if expiry is in the future
    if (expiryDate < new Date()) {
        console.warn('⚠️  Warning: Expiry date is in the past!');
    }
    
    // BATCH mode
    if (options.batch) {
        if (!fs.existsSync(options.batch)) {
            console.error(`Error: Batch file not found: ${options.batch}`);
            process.exit(1);
        }
        
        console.log(`📁 Reading batch file: ${options.batch}`);
        const devices = readBatchFile(options.batch);
        
        if (devices.length === 0) {
            console.error('Error: No valid hardware IDs found in batch file');
            process.exit(1);
        }
        
        console.log(`Found ${devices.length} device(s)\n`);
        
        const startTime = Date.now();
        const licenses = devices.map(d => {
            const license = generateLicense(d.hardwareId, expiryDate);
            license.deviceName = d.deviceName;
            return license;
        });
        const elapsed = Date.now() - startTime;
        
        console.log(`✓ Generated ${licenses.length} license(s) in ${elapsed}ms\n`);
        
        // Export to CSV
        const outputPath = options.output 
            ? path.resolve(options.output)
            : path.resolve('licenses_' + formatDate(new Date()) + '.csv');
        exportToCSV(licenses, outputPath);
        console.log(`✓ Exported to: ${outputPath}\n`);
        
        // Show sample
        console.log('Sample licenses generated:');
        console.log('─'.repeat(70));
        licenses.slice(0, 3).forEach((license, index) => {
            console.log(`  ${index + 1}. ${license.deviceName}`);
            console.log(`     HW: ${license.hardwareId}...`);
            console.log(`     Key: ${license.key}`);
        });
        if (licenses.length > 3) {
            console.log(`  ... and ${licenses.length - 3} more`);
        }
        console.log('─'.repeat(70));
        
    } 
    // SINGLE mode
    else if (options.hardware) {
        if (options.hardware.length < 8) {
            console.error('Error: Hardware ID must be at least 8 characters');
            process.exit(1);
        }
        
        console.log(`Hardware ID: ${options.hardware}`);
        console.log(`Expiry Date: ${formatDate(expiryDate)}\n`);
        
        const license = generateLicense(options.hardware, expiryDate);
        
        console.log('✓ License Generated!\n');
        console.log('═'.repeat(50));
        console.log(`  License Key: ${license.key}`);
        console.log('═'.repeat(50));
        console.log(`  Hardware ID: ${license.hardwareIdFull}`);
        console.log(`  Expiry: ${license.expiryDate}`);
        console.log('');
        
        if (options.output) {
            exportToCSV([license], path.resolve(options.output));
            console.log(`✓ Exported to: ${options.output}\n`);
        }
    } 
    // No hardware specified
    else {
        console.error('Error: Hardware ID is required for pre-binding.');
        console.error('');
        console.error('Usage:');
        console.error('  Single: node license-generator.js --hardware <HW_ID> --expiry 2026-12-31');
        console.error('  Batch:  node license-generator.js --batch ids.csv --expiry 2026-12-31');
        console.error('');
        console.error('Get Hardware ID from: Help → View License in the app');
        process.exit(1);
    }
}

// Run
main();
