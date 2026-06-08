// Portal Center — Build Script
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PRODUCT_NAME = 'Portal Center';
const APP_DIR = __dirname;
const OUT_DIR = path.join(APP_DIR, 'release-builds');

const IGNORE_PATTERNS = [
	'\\.git',
	'release-builds',
	'node_modules/electron($|/)',
	'node_modules/electron-packager($|/)',
	'\\.gitignore',
	'build\\.js',
	'README\\.md',
].map(p => `--ignore="${p}"`).join(' ');

console.log(`\n  Building ${PRODUCT_NAME}...\n`);

try {
	const cmd = [
		'npx electron-packager .',
		'--overwrite',
		'--asar',
		'--platform=win32',
		'--arch=x64',
		'--icon=assets/icons/win/icon.ico',
		'--prune=true',
		`--out="${OUT_DIR}"`,
		`--app-version="1.0.0"`,
		`--version-string.ProductName="${PRODUCT_NAME}"`,
		`--version-string.CompanyName="CE"`,
		`--version-string.FileDescription="${PRODUCT_NAME}"`,
		IGNORE_PATTERNS,
	].join(' ');

	console.log('  Command:', cmd, '\n');
	execSync(cmd, { cwd: APP_DIR, stdio: 'inherit' });

	// Inject ffmpeg.dll into the built app executable folder (for H.264/HEVC proprietary codecs support)
	const ffmpegSource = path.join(__dirname, 'node_modules', 'electron', 'dist', 'ffmpeg.dll');
	const outputFolder = path.join(OUT_DIR, `${PRODUCT_NAME}-win32-x64`);
	const targetDll = path.join(outputFolder, 'ffmpeg.dll');
	
	if (fs.existsSync(ffmpegSource) && fs.existsSync(outputFolder)) {
		fs.copyFileSync(ffmpegSource, targetDll);
		console.log(`  ✅ Injected custom ffmpeg.dll into ${outputFolder}`);
	}

	console.log(`\n  ✅ Build complete! Output: ${OUT_DIR}\n`);
} catch (e) {
	console.error('\n  ❌ Build failed:', e.message, '\n');
	process.exit(1);
}
