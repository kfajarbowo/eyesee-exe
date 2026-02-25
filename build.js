const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const buildConfig = {
	windows: {
		target: 'win32',
		arch: 'ia32',
		icon: 'assets/icons/win/logo-eyesee.ico',
		out: 'release-builds/windows',
		extra: {
			VersionString: {
				CompanyName: 'CE',
				FileDescription: 'EyeSee Application',
				ProductName: 'EyeSee',
				OriginalFilename: 'EyeSee.exe',
			},
		},
	},
	macos: {
		target: 'darwin',
		arch: 'arm64',
		icon: 'assets/icons/mac/icon.icns',
		out: 'release-builds/mac',
	},
	linux: {
		target: 'linux',
		arch: 'x64',
		icon: 'assets/icons/png/logo-eyesee.png',
		out: 'release-builds/linux',
	},
};

const IGNORE_PATTERNS = [
	'^/blm-exe',
	'^/bms-exe',
	'^/vcomm-exee',
	'^/license-server$',
	'^/license-admin-tool',
	'^/tools',
	'^/release-builds',
	'^/\\.git',
	'^/\\.github',
	'^/\\.vscode',
	'^/\\.agent',
	'^/screenshot\\.png',
	'^/README\\.md',
];

function ensureDirectoryExists(dirPath) {
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
	}
}

function copyExtraFiles(outputDir) {
	const filesToCopy = [
		{
			srcs: [path.join('node_modules', 'electron', 'dist', 'icudtl.dat')],
			dest: 'icudtl.dat',
			required: true,
			description: 'ICU data (Unicode support)'
		},
		{
			srcs: ['server-config.json'],
			dest: 'server-config.json',
			required: false,
			description: 'License server config'
		},
	];

	console.log('\n📋 Copying extra files...');

	for (const file of filesToCopy) {
		const destPath = path.join(outputDir, file.dest);
		let copied = false;

		for (const src of file.srcs) {
			const srcPath = path.join(__dirname, src);
			if (fs.existsSync(srcPath)) {
				fs.copyFileSync(srcPath, destPath);
				console.log(`  ✅ Copied: ${file.dest} (${file.description})`);
				copied = true;
				break;
			}
		}

		if (!copied) {
			if (file.required) {
				console.error(`  ❌ REQUIRED file not found: ${file.dest}`);
				process.exit(1);
			} else {
				console.warn(`  ⚠️  Optional file not found (skipped): ${file.dest}`);
			}
		}
	}
}

function findOutputFolder(baseOutDir, platform) {
	if (!fs.existsSync(baseOutDir)) return null;
	const entries = fs.readdirSync(baseOutDir);
	const match = entries.find(e => {
		try {
			const stat = fs.statSync(path.join(baseOutDir, e));
			return stat.isDirectory() && e.toLowerCase().includes(platform);
		} catch { return false; }
	});
	return match ? path.join(baseOutDir, match) : null;
}

function clearPackagerTemp() {
	const tempDir = path.join(process.env.TEMP || process.env.TMP || os.tmpdir(), 'electron-packager');
	if (fs.existsSync(tempDir)) {
		try {
			execSync(`rmdir /s /q "${tempDir}"`, { stdio: 'ignore', shell: true });
			console.log('🧹 Cleared electron-packager temp cache');
		} catch (e) {
			console.warn('⚠️  Could not clear temp cache:', e.message);
		}
	}
}

function forceDeleteOutputFolder(config) {
	// Hapus SELURUH isi folder output (misal: release-builds/windows)
	// bukan hanya subfolder, agar tidak ada sisa yang terkunci
	const baseOutDir = path.join(__dirname, config.out);
	if (!fs.existsSync(baseOutDir)) return;

	try {
		execSync(`rmdir /s /q "${baseOutDir}"`, { stdio: 'ignore', shell: true });
		console.log(`🗑️  Cleared output dir: ${config.out}`);
	} catch (e) {
		console.warn(`⚠️  Could not clear output dir (${e.message}), --overwrite will handle it`);
	}
}

function build(platform) {
	const config = buildConfig[platform];
	if (!config) {
		console.error(`Unsupported platform: ${platform}`);
		console.log('Usage: node build.js <windows|macos|linux>');
		process.exit(1);
	}

	console.log(`\n🔨 Building EyeSee for ${platform} (${config.arch})...`);

	// Kill semua proses Electron/EXE yang mungkin mengunci file output
	try {
		execSync('taskkill /f /im "Electron webview.exe" 2>nul', { stdio: 'ignore', shell: true });
		execSync('taskkill /f /im "electron.exe" 2>nul', { stdio: 'ignore', shell: true });
	} catch (e) { /* tidak masalah jika tidak ada proses */ }

	clearPackagerTemp();
	forceDeleteOutputFolder(config);

	const packageCmd = `npx electron-packager . ${getPackageArgs(config)}`;

	try {
		execSync(packageCmd, { stdio: 'inherit' });
		console.log(`\n✅ Build completed for ${platform}`);

		const outputFolder = findOutputFolder(
			path.join(__dirname, config.out),
			config.target
		);

		if (outputFolder) {
			copyExtraFiles(outputFolder);
			console.log(`\n📦 Output: ${outputFolder}`);
		} else {
			console.warn('⚠️  Could not find output folder for extra files.');
		}

	} catch (error) {
		console.error(`\n❌ Build failed for ${platform}:`, error.message);
		process.exit(1);
	}
}

function getPackageArgs(config) {
	let args = [
		'--overwrite',          // Wajib ada agar tidak write ke "true"
		`--platform=${config.target}`,
		`--arch=${config.arch}`,
		`--icon=${config.icon}`,
		`--out=${config.out}`,
		// TIDAK pakai --prune=true karena menyebabkan ENOENT/chmod error di Windows
	];

	IGNORE_PATTERNS.forEach(pattern => {
		args.push(`--ignore="${pattern}"`);
	});

	if (config.extra && config.extra.VersionString) {
		Object.entries(config.extra.VersionString).forEach(([key, value]) => {
			args.push(`--version-string.${key}="${value}"`);
		});
	}

	return args.join(' ');
}

const platform = process.argv[2] || 'windows';
Object.values(buildConfig).forEach(config => ensureDirectoryExists(config.out));
build(platform);
