const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const buildConfig = {
	windows: {
		target: 'win32',
		arch: 'ia32',
		icon: 'assets/icons/win/icon-vcom.png',
		out: 'release-builds/windows',
		extra: {
			VersionString: {
				CompanyName: 'CE',
				FileDescription: 'VComm Application',
				ProductName: 'VComm',
				OriginalFilename: 'VComm.exe',
			},
		},
	},
	macos: {
		target: 'darwin',
		arch: 'x64',
		icon: 'assets/icons/mac/icon.icns',
		out: 'release-builds/mac',
	},
	linux: {
		target: 'linux',
		arch: 'x64',
		icon: 'assets/icons/png/1024x1024.png',
		out: 'release-builds/linux',
	},
};

function ensureDirectoryExists(dirPath) {
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
	}
}

function copyExtraFiles(outputDir, arch) {
	const icuPaths = [
		path.join('node_modules', 'electron', 'dist', 'icudtl.dat'),
		path.join('node_modules', 'electron', 'dist', arch, 'icudtl.dat'),
	];

	const filesToCopy = [
		{
			srcs: icuPaths,
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
		process.exit(1);
	}

	console.log(`\n🔨 Building VComm for ${platform} (${config.arch})...`);

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
			copyExtraFiles(outputFolder, config.arch);
			console.log(`\n📦 Output: ${outputFolder}`);
		} else {
			console.warn('⚠️  Could not find output folder for extra files.');
		}

	} catch (error) {
		console.error(`❌ Build failed for ${platform}:`, error.message);
		process.exit(1);
	}
}

function getPackageArgs(config) {
	let args = [
		'--overwrite',
		`--platform=${config.target}`,
		`--arch=${config.arch}`,
		`--icon=${config.icon}`,
		`--out=${config.out}`,
		'--asar=true',
		// Ignore release-builds agar EXE lama tidak ikut dikopi ke temp (ENOSPC fix)
		'--ignore="^/release-builds"',
		'--ignore="^/node_modules/.bin"',
		// TIDAK pakai --prune=true
	];

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
