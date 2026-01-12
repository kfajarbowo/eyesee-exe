const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Build configuration
const buildConfig = {
	windows: {
		target: 'win32',
		arch: 'x64',
		icon: 'assets/icons/win/blm-webview.ico',
		out: 'release-builds/windows',
		extra: {
			VersionString: {
				CompanyName: 'BLM',
				FileDescription: 'BLM Webview Application',
				ProductName: 'BLM Webview',
				OriginalFilename: 'BLM-Webview.exe',
			},
		},
	},
	macos: {
		target: 'darwin',
		arch: 'x64',
		icon: 'assets/icons/mac/icon.icns',
		out: 'release-builds/mac',
		extra: {
			VersionString: {
				CompanyName: 'BLM',
				FileDescription: 'BLM Webview Application',
				ProductName: 'BLM Webview',
			},
		},
	},
	linux: {
		target: 'linux',
		arch: 'x64',
		icon: 'assets/icons/png/1024x1024.png',
		out: 'release-builds/linux',
	},
};

// Create directories if they don't exist
function ensureDirectoryExists(dirPath) {
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
	}
}

// Build function
function build(platform) {
	const config = buildConfig[platform];
	if (!config) {
		console.error(`Unsupported platform: ${platform}`);
		process.exit(1);
	}

	console.log(`Building for ${platform}...`);

	const packageCmd = `electron-packager . ${getPackageArgs(config)}`;

	try {
		execSync(packageCmd, { stdio: 'inherit' });
		console.log(`✅ Build completed for ${platform}`);
		console.log(`📦 Output: ${config.out}/`);
	} catch (error) {
		console.error(`❌ Build failed for ${platform}:`, error.message);
		process.exit(1);
	}
}

// Get package arguments
function getPackageArgs(config) {
	let args = [
		'--overwrite',
		'--asar=true',
		`--platform=${config.target}`,
		`--arch=${config.arch}`,
		`--icon=${config.icon}`,
		`--out=${config.out}`,
		'--prune=true',
	];

	// Add version string for Windows
	if (config.extra && config.extra.VersionString) {
		Object.entries(config.extra.VersionString).forEach(([key, value]) => {
			args.push(`--version-string.${key}="${value}"`);
		});
	}

	return args.join(' ');
}

// Main build process
const platform = process.argv[2];
if (!platform) {
	console.error('Please specify platform: windows, macos, or linux');
	console.log('Usage: node build.js <platform>');
	process.exit(1);
}

// Ensure output directories exist
Object.values(buildConfig).forEach(config => {
	ensureDirectoryExists(config.out);
});

build(platform);
