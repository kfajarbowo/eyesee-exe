/**
 * Production Environment Configuration Check
 * This script runs on startup to ensure all required environment variables are set
 * Sets default values for missing variables to allow deployment
 */

// Default values for environment variables
const defaults = {
    PORT: '8000',
    HOST: '0.0.0.0',
    ADMIN_PASSWORD: 'admin123',
    OFFLINE_TOLERANCE_HOURS: '24'
};

const requiredEnvVars = [
    'PORT',
    'HOST',
    'ADMIN_PASSWORD',
    'OFFLINE_TOLERANCE_HOURS'
];

const optionalEnvVars = [
    'NODE_ENV'
];

function validateEnvironment() {
    console.log('[ENV] Validating environment variables...');
    
    let hasWarnings = false;
    
    // Check and set defaults for required variables
    requiredEnvVars.forEach(varName => {
        if (!process.env[varName]) {
            if (defaults[varName]) {
                process.env[varName] = defaults[varName];
                console.warn(`[ENV] ⚠️  ${varName}: not set, using default value`);
                hasWarnings = true;
            } else {
                console.error(`[ENV] ❌ Missing required environment variable: ${varName}`);
                process.exit(1);
            }
        } else {
            console.log(`[ENV] ✓ ${varName}: ${varName === 'ADMIN_PASSWORD' ? '***' : process.env[varName]}`);
        }
    });
    
    // Check optional variables
    optionalEnvVars.forEach(varName => {
        if (process.env[varName]) {
            console.log(`[ENV] ✓ ${varName}: ${process.env[varName]}`);
        } else {
            console.log(`[ENV] ℹ ${varName}: not set (using default)`);
        }
    });
    
    // Security warnings
    if (process.env.ADMIN_PASSWORD === 'admin123') {
        console.warn('[ENV] ⚠️  WARNING: Using default admin password "admin123"!');
        console.warn('[ENV] ⚠️  SECURITY RISK: Please set ADMIN_PASSWORD environment variable immediately!');
        hasWarnings = true;
    }
    
    if (hasWarnings) {
        console.warn('[ENV] ⚠️  Environment validation completed with warnings');
        console.warn('[ENV] ⚠️  Please set proper environment variables in production!');
    } else {
        console.log('[ENV] ✅ Environment validation passed');
    }
}

module.exports = { validateEnvironment };
