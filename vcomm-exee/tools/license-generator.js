#!/usr/bin/env node

/**
 * License Key Generator Tool (Post-binding)
 * 
 * CLI tool for generating license keys for VComm application.
 * Keys generated WITHOUT hardware ID - binding happens on server.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================================================
// Configuration - VCOMM
// ============================================================================

const CONFIG = {
    SEGMENT_LENGTH: 4,
    CHARSET: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    SECRET_KEY: 'vcomm-license-secret-key-2024-v2',
    PRODUCT_CODE: 'VC01',
    PRODUCT_NAME: 'VComm'
};

// ============================================================================
// Key Generation
// ============================================================================

function generateRandomSegment(length) {
    const bytes = crypto.randomBytes(length * 2);
    let result = '';
    for (let i = 0; i < length; i++) {
        result += CONFIG.CHARSET[bytes[i] % CONFIG.CHARSET.length];
    }
    return result;
}

function encodeBase36(num, length) {
    const chars = CONFIG.CHARSET;
    let result = '';
    while (num > 0) {
        result = chars[num % chars.length] + result;
        num = Math.floor(num / chars.length);
    }
    while (result.length < length) {
        result = chars[0] + result;
    }
    return result.substring(0, length);
}

function generateChecksum(data) {
    const hash = crypto.createHmac('sha256', CONFIG.SECRET_KEY).update(data).digest('hex');
    const num = parseInt(hash.substring(0, 8), 16);
    return encodeBase36(num, CONFIG.SEGMENT_LENGTH);
}

function generateKey() {
    const seg1 = generateRandomSegment(2) + CONFIG.PRODUCT_CODE.substring(0, 2);
    const seg2 = CONFIG.PRODUCT_CODE.substring(2, 4) + generateRandomSegment(2);
    const seg3 = generateRandomSegment(4);
    const seg4 = generateChecksum(seg1 + seg2 + seg3);
    
    return `${seg1}-${seg2}-${seg3}-${seg4}`;
}

// ============================================================================
// CLI
// ============================================================================

function parseArgs() {
    const args = process.argv.slice(2);
    const options = { count: 1, output: null, help: false };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--count': case '-c': case '-n':
                options.count = parseInt(args[++i]) || 1;
                break;
            case '--output': case '-o':
                options.output = args[++i];
                break;
            case '--help': case '-h':
                options.help = true;
                break;
        }
    }

    return options;
}

function showHelp() {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║         ${CONFIG.PRODUCT_NAME} License Generator (Post-binding)            ║
╚══════════════════════════════════════════════════════════════════╝

Usage: node license-generator.js [options]

Options:
  -c, --count <N>    Number of keys (default: 1)
  -o, --output <f>   Output CSV file
  -h, --help         Show help

Examples:
  node license-generator.js --count 10
  node license-generator.js --count 5 --output keys.csv
`);
}

function exportToCSV(keys, filepath) {
    const headers = ['LICENSE_KEY', 'PRODUCT', 'CREATED_AT', 'STATUS'];
    const rows = keys.map(k => [k.key, k.product, k.createdAt, 'unused']);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    fs.writeFileSync(filepath, csv, 'utf8');
}

function main() {
    const options = parseArgs();
    
    if (options.help) {
        showHelp();
        process.exit(0);
    }
    
    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log(`║         ${CONFIG.PRODUCT_NAME} License Generator (Post-binding)            ║`);
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');
    
    const count = Math.min(Math.max(1, options.count), 100);
    console.log(`Generating ${count} license key(s)...\n`);
    
    const keys = [];
    for (let i = 0; i < count; i++) {
        keys.push({
            key: generateKey(),
            product: CONFIG.PRODUCT_NAME,
            createdAt: new Date().toISOString().split('T')[0]
        });
    }
    
    console.log('✓ Generated!\n');
    console.log('═'.repeat(50));
    keys.forEach((k, i) => {
        console.log(`  ${(i+1).toString().padStart(2)}. ${k.key}`);
    });
    console.log('═'.repeat(50));
    console.log(`\nProduct: ${CONFIG.PRODUCT_NAME}\n`);
    
    if (options.output) {
        const outputPath = path.resolve(options.output);
        exportToCSV(keys, outputPath);
        console.log(`✓ Exported to: ${outputPath}\n`);
    }
}

main();
