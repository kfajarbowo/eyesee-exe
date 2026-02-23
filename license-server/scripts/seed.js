/**
 * License Server Seeder
 * 
 * Generate initial license keys untuk semua produk.
 * Jalankan: node scripts/seed.js
 * 
 * Options:
 *   node scripts/seed.js              → default: 2 keys per produk
 *   node scripts/seed.js --qty 5      → 5 keys per produk
 *   node scripts/seed.js --product ES01 --qty 10  → 10 keys untuk ES01 saja
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { generatedKeysRepo } = require('../database/db');
const crypto = require('crypto');

// ============================================================================
// Config
// ============================================================================

const PRODUCTS = {
    BM01: { name: 'BMS',    secretKey: 'bms-license-secret-key-2024-v2' },
    BL01: { name: 'BLM',    secretKey: 'blm-license-secret-key-2024-v2' },
    VC01: { name: 'VComm',  secretKey: 'vcomm-license-secret-key-2024-v2' },
    ES01: { name: 'EyeSee', secretKey: 'eyesee-license-secret-key-2024-v2' },
};

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// ============================================================================
// Key Generation
// ============================================================================

function encodeBase36(num, length) {
    let result = '';
    while (num > 0) {
        result = CHARSET[num % CHARSET.length] + result;
        num = Math.floor(num / CHARSET.length);
    }
    while (result.length < length) result = CHARSET[0] + result;
    return result.substring(0, length);
}

function generateChecksum(data, secretKey) {
    const hash = crypto.createHmac('sha256', secretKey).update(data).digest('hex');
    return encodeBase36(parseInt(hash.substring(0, 8), 16), 4);
}

function generateRandomSegment(length) {
    const bytes = crypto.randomBytes(length * 2);
    let result = '';
    for (let i = 0; i < length; i++) {
        result += CHARSET[bytes[i] % CHARSET.length];
    }
    return result;
}

function generateKey(productCode, secretKey) {
    const productChars = productCode; // e.g. "BM01"
    const rand1 = generateRandomSegment(2);
    const rand2 = generateRandomSegment(2);
    const rand3 = generateRandomSegment(4);

    const seg1 = rand1 + productChars.substring(0, 2); // XX + BM
    const seg2 = productChars.substring(2, 4) + rand2;  // 01 + XX
    const seg3 = rand3;                                  // XXXX
    const seg4 = generateChecksum(seg1 + seg2 + seg3, secretKey);

    return `${seg1}-${seg2}-${seg3}-${seg4}`;
}

// ============================================================================
// Parse CLI args
// ============================================================================

const args = process.argv.slice(2);
let targetProduct = null;
let qty = 2;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--product' && args[i + 1]) targetProduct = args[i + 1].toUpperCase();
    if (args[i] === '--qty' && args[i + 1]) qty = parseInt(args[i + 1]) || 2;
}

// ============================================================================
// Seeder
// ============================================================================

function seed() {
    const productsToSeed = targetProduct
        ? { [targetProduct]: PRODUCTS[targetProduct] }
        : PRODUCTS;

    if (targetProduct && !PRODUCTS[targetProduct]) {
        console.error(`❌ Product tidak ditemukan: ${targetProduct}`);
        console.log(`   Pilihan: ${Object.keys(PRODUCTS).join(', ')}`);
        process.exit(1);
    }

    console.log('\n🌱 License Server Seeder');
    console.log('─'.repeat(50));
    console.log(`📦 Products: ${Object.keys(productsToSeed).join(', ')}`);
    console.log(`🔢 Qty per product: ${qty}`);
    console.log('─'.repeat(50));

    let totalGenerated = 0;
    let totalSkipped = 0;
    const results = {};

    for (const [code, product] of Object.entries(productsToSeed)) {
        results[code] = [];
        console.log(`\n📝 ${code} - ${product.name}:`);

        for (let i = 0; i < qty; i++) {
            let key;
            let attempts = 0;

            // Generate unique key (max 10 attempts)
            do {
                key = generateKey(code, product.secretKey);
                attempts++;
                const existing = generatedKeysRepo.findByKey(key);
                if (!existing) break;
            } while (attempts < 10);

            if (attempts >= 10) {
                console.log(`  ⚠️  Gagal generate key unik setelah 10 percobaan`);
                totalSkipped++;
                continue;
            }

            try {
                generatedKeysRepo.create({
                    license_key: key,
                    product_code: code,
                });
                console.log(`  ✅ ${key}`);
                results[code].push(key);
                totalGenerated++;
            } catch (err) {
                if (err.message && err.message.includes('UNIQUE')) {
                    console.log(`  ⏭️  Skipped (duplicate): ${key}`);
                    totalSkipped++;
                } else {
                    console.error(`  ❌ Error: ${err.message}`);
                }
            }
        }
    }

    console.log('\n' + '─'.repeat(50));
    console.log(`\n✅ Seeder selesai!`);
    console.log(`   Generated : ${totalGenerated} keys`);
    if (totalSkipped > 0) {
        console.log(`   Skipped   : ${totalSkipped} keys`);
    }

    // Summary
    console.log('\n📋 Summary:');
    for (const [code, keys] of Object.entries(results)) {
        if (keys.length > 0) {
            console.log(`   ${code}: ${keys.length} keys`);
        }
    }

    console.log('');
}

seed();
