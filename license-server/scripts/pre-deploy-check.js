#!/usr/bin/env node
/**
 * Pre-deployment Check Script
 * Verifies that the application is ready for deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Running Pre-Deployment Checks...\n');

let hasErrors = false;

// Check 1: package.json exists
console.log('✓ Checking package.json...');
if (!fs.existsSync('./package.json')) {
    console.error('❌ package.json not found!');
    hasErrors = true;
} else {
    const pkg = require('./package.json');
    if (!pkg.engines || !pkg.engines.node) {
        console.warn('⚠️  Warning: Node.js engine version not specified');
    }
    console.log(`  - Name: ${pkg.name}`);
    console.log(`  - Version: ${pkg.version}`);
}

// Check 2: server.js exists
console.log('\n✓ Checking server.js...');
if (!fs.existsSync('./server.js')) {
    console.error('❌ server.js not found!');
    hasErrors = true;
}

// Check 3: Environment variables
console.log('\n✓ Checking environment configuration...');
if (!fs.existsSync('./.env.example')) {
    console.warn('⚠️  Warning: .env.example not found');
} else {
    const envExample = fs.readFileSync('./.env.example', 'utf8');
    const requiredVars = ['ADMIN_PASSWORD', 'PORT', 'OFFLINE_TOLERANCE_HOURS'];
    
    requiredVars.forEach(varName => {
        if (envExample.includes(varName)) {
            console.log(`  - ${varName}: documented`);
        } else {
            console.warn(`  ⚠️  ${varName}: not documented`);
        }
    });
}

// Check 4: .gitignore exists
console.log('\n✓ Checking .gitignore...');
if (!fs.existsSync('./.gitignore')) {
    console.error('❌ .gitignore not found! Create it to prevent sensitive files from being committed.');
    hasErrors = true;
} else {
    const gitignore = fs.readFileSync('./.gitignore', 'utf8');
    if (!gitignore.includes('.env')) {
        console.error('❌ .gitignore does not exclude .env file!');
        hasErrors = true;
    }
    if (!gitignore.includes('node_modules')) {
        console.warn('⚠️  Warning: node_modules not in .gitignore');
    }
}

// Check 5: Database initialization
console.log('\n✓ Checking database setup...');
if (!fs.existsSync('./database/schema.js')) {
    console.error('❌ Database schema not found!');
    hasErrors = true;
}

// Check 6: Routes
console.log('\n✓ Checking API routes...');
const requiredRoutes = ['./routes/license.js', './routes/admin.js'];
requiredRoutes.forEach(route => {
    if (fs.existsSync(route)) {
        console.log(`  - ${path.basename(route)}: ✓`);
    } else {
        console.error(`  ❌ ${path.basename(route)}: not found`);
        hasErrors = true;
    }
});

// Summary
console.log('\n' + '='.repeat(60));
if (hasErrors) {
    console.error('❌ Pre-deployment checks FAILED!');
    console.error('Please fix the errors above before deploying.');
    process.exit(1);
} else {
    console.log('✅ All checks passed! Ready for deployment.');
    console.log('\nNext steps:');
    console.log('1. Push code to GitHub');
    console.log('2. Deploy to Koyeb');
    console.log('3. Set environment variables in Koyeb Dashboard');
    console.log('\nSee QUICK_START.md for deployment instructions.');
}
console.log('='.repeat(60));
