/**
 * Admin Account Seeder
 * 
 * Buat akun admin awal karena tidak ada halaman register.
 * 
 * Usage:
 *   node scripts/seed-admin.js                          → buat akun default (admin/admin123)
 *   node scripts/seed-admin.js --username ops --password secret123
 *   node scripts/seed-admin.js --list                   → tampilkan semua akun
 *   node scripts/seed-admin.js --reset admin            → reset password akun admin ke default
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const crypto = require('crypto');
const { initializeDatabase } = require('../database/schema');
const { adminUsersRepo } = require('../database/db');

// Init DB
initializeDatabase();

// ============================================================================
// Helpers
// ============================================================================

function hashPassword(password) {
    return crypto
        .createHmac('sha256', process.env.ADMIN_SECRET || 'eyesee-admin-secret-2024')
        .update(password)
        .digest('hex');
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('id-ID');
}

// ============================================================================
// Parse CLI args
// ============================================================================

const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
        const key = args[i].slice(2);
        flags[key] = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
        if (flags[key] !== true) i++;
    }
}

// ============================================================================
// Commands
// ============================================================================

// --list → tampilkan semua akun
if (flags.list) {
    const users = adminUsersRepo.getAll();
    console.log('\n👥 Admin Users:');
    console.log('─'.repeat(60));
    if (users.length === 0) {
        console.log('  (belum ada akun)\n');
    } else {
        users.forEach(u => {
            const status = u.is_active ? '✅ Active' : '❌ Inactive';
            console.log(`  [${u.id}] ${u.username} | ${u.role} | ${status}`);
            console.log(`       Created: ${formatDate(u.created_at)}`);
            console.log(`       Last Login: ${formatDate(u.last_login_at)}`);
        });
        console.log('');
    }
    process.exit(0);
}

// --reset <username> → reset password ke default
if (flags.reset) {
    const username = typeof flags.reset === 'string' ? flags.reset : 'admin';
    const newPassword = flags.password || 'admin123';
    const user = adminUsersRepo.findByUsername(username);

    if (!user) {
        console.error(`❌ User '${username}' tidak ditemukan`);
        process.exit(1);
    }

    adminUsersRepo.updatePassword(username, hashPassword(newPassword));
    console.log(`\n✅ Password '${username}' berhasil direset ke: ${newPassword}\n`);
    process.exit(0);
}

// --deactivate <username> → nonaktifkan akun
if (flags.deactivate) {
    const username = typeof flags.deactivate === 'string' ? flags.deactivate : null;
    if (!username) {
        console.error('❌ Specify username: --deactivate <username>');
        process.exit(1);
    }

    adminUsersRepo.deactivate(username);
    console.log(`\n✅ Akun '${username}' dinonaktifkan\n`);
    process.exit(0);
}

// Default: buat akun baru
const username = flags.username || 'admin';
const password = flags.password || (process.env.ADMIN_PASSWORD || 'admin123');
const role = flags.role || 'admin';

console.log('\n🌱 Admin Account Seeder');
console.log('─'.repeat(40));

// Cek apakah sudah ada
const existing = adminUsersRepo.findByUsername(username);
if (existing) {
    console.log(`⚠️  Akun '${username}' sudah ada (id: ${existing.id})`);
    console.log(`   Gunakan --reset ${username} untuk reset password\n`);
    process.exit(0);
}

// Create
try {
    const passwordHash = hashPassword(password);
    const user = adminUsersRepo.create(username, passwordHash, role);

    console.log(`✅ Akun admin berhasil dibuat!\n`);
    console.log(`   Username : ${username}`);
    console.log(`   Password : ${password}`);
    console.log(`   Role     : ${role}`);
    console.log(`   ID       : ${user.id}`);
    console.log('');
    console.log('⚠️  PENTING: Segera ganti password setelah login pertama!');
    console.log('');
} catch (err) {
    console.error('❌ Gagal buat akun:', err.message);
    process.exit(1);
}
