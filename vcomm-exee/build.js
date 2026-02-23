const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const buildConfig = {
	windows: {
		target: 'win32',
		arch: 'ia32',  // VComm pakai 32-bit
		icon: 'assets/icons/win/logo-eyesee.ico',
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
		const stat = fs.statSync(path.join(baseOutDir, e));
		return stat.isDirectory() && e.toLowerCase().includes(platform);
	});
	return match ? path.join(baseOutDir, match) : null;
}

function build(platform) {
	const config = buildConfig[platform];
	if (!config) {
		console.error(`Unsupported platform: ${platform}`);
		process.exit(1);
	}

	console.log(`\n🔨 Building VComm for ${platform} (${config.arch})...`);

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
		'--asar',
		`--platform=${config.target}`,
		`--arch=${config.arch}`,
		`--icon=${config.icon}`,
		`--out=${config.out}`,
		'--prune=true',
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
