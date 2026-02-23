const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const buildConfig = {
	windows: {
		target: 'win32',
		arch: 'x64',
		icon: 'assets/icons/win/logo-bms.ico',
		out: 'release-builds/windows',
		extra: {
			VersionString: {
				CompanyName: 'CE',
				FileDescription: 'BMS Application',
				ProductName: 'BMS Application',
				OriginalFilename: 'BMS-Application.exe',
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

function copyExtraFiles(outputDir) {
	const filesToCopy = [
		{
			src: path.join('node_modules', 'electron', 'dist', 'icudtl.dat'),
			dest: 'icudtl.dat',
			required: true
		},
		{
			src: 'server-config.json',
			dest: 'server-config.json',
			required: false
		},
	];

	console.log('\n📋 Copying extra files...');

	for (const file of filesToCopy) {
		const srcPath = path.join(__dirname, file.src);
		const destPath = path.join(outputDir, file.dest);

		if (fs.existsSync(srcPath)) {
			fs.copyFileSync(srcPath, destPath);
			console.log(`  ✅ Copied: ${file.dest}`);
		} else if (file.required) {
			console.error(`  ❌ REQUIRED file not found: ${file.src}`);
			process.exit(1);
		} else {
			console.warn(`  ⚠️  Optional file not found (skipped): ${file.src}`);
		}
	}
}

function findOutputFolder(baseOutDir, platform, arch) {
	if (!fs.existsSync(baseOutDir)) return null;

	const entries = fs.readdirSync(baseOutDir);
	const match = entries.find(e => {
		const stat = fs.statSync(path.join(baseOutDir, e));
		return stat.isDirectory() && e.includes(platform) && e.includes(arch);
	});

	return match ? path.join(baseOutDir, match) : null;
}

function build(platform) {
	const config = buildConfig[platform];
	if (!config) {
		console.error(`Unsupported platform: ${platform}`);
		process.exit(1);
	}

	console.log(`\n🔨 Building BMS for ${platform}...`);

	const packageCmd = `electron-packager . ${getPackageArgs(config)}`;

	try {
		execSync(packageCmd, { stdio: 'inherit' });
		console.log(`\n✅ Build completed for ${platform}`);

		const outputFolder = findOutputFolder(
			path.join(__dirname, config.out),
			config.target,
			'x64'
		);

		if (outputFolder) {
			copyExtraFiles(outputFolder);
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

const platform = process.argv[2];
if (!platform) {
	console.error('Please specify platform: windows, macos, or linux');
	console.log('Usage: node build.js <platform>');
	process.exit(1);
}

Object.values(buildConfig).forEach(config => {
	ensureDirectoryExists(config.out);
});

build(platform);
