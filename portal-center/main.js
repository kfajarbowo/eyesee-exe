// Portal Center — Electron Main Process
const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// ── Configuration ──────────────────────────────────────────────
function loadConfig() {
	const configPath = app.isPackaged
		? path.join(path.dirname(process.execPath), 'server-config.json')
		: path.join(__dirname, 'server-config.json');
	try {
		return JSON.parse(fs.readFileSync(configPath, 'utf8'));
	} catch (e) {
		console.error('[Portal] Failed to load config:', e.message);
		return { apiBaseUrl: 'https://trizein.vercel.app/api/v1' };
	}
}

const config = loadConfig();
const API_BASE = config.apiBaseUrl || 'https://trizein.vercel.app/api/v1';
console.log('[Portal] API Base URL:', API_BASE);

// ============================================================================
// Chromium Flags for Media Codecs & GPU (HEVC / H.265 Support)
// ============================================================================
app.commandLine.appendSwitch(
	'enable-features',
	'PlatformHEVCDecoderSupport,WebRtcAllowH265Receive'
);
app.commandLine.appendSwitch(
	'force-fieldtrials',
	'WebRTC-Video-H26xPacketBuffer/Enabled/'
);
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns');

// ── Secure Origin Whitelist for WebRTC ────────────────────────
// navigator.mediaDevices.getUserMedia requires a secure context.
// HTTP site origins are whitelisted via unsafely-treat-insecure-origin-as-secure.
// We use a local cache so the whitelist works even when the API is slow/offline.
const ORIGINS_CACHE_FILE = path.join(app.getPath('userData'), 'site-origins-cache.json');

function loadCachedOrigins() {
	try {
		const data = JSON.parse(fs.readFileSync(ORIGINS_CACHE_FILE, 'utf8'));
		console.log('[Portal] Loaded', data.length, 'origins from local cache');
		return Array.isArray(data) ? data : [];
	} catch (e) {
		return [];
	}
}

function saveCachedOrigins(origins) {
	try {
		fs.writeFileSync(ORIGINS_CACHE_FILE, JSON.stringify(origins));
		console.log('[Portal] Saved', origins.length, 'origins to local cache');
	} catch (e) {
		console.warn('[Portal] Failed to save origins cache:', e.message);
	}
}

function prefetchSiteOrigins(apiUrl) {
	if (!apiUrl) return [];
	try {
		const { execFileSync } = require('child_process');
		const script = `
			const http = require('http');
			const https = require('https');
			const url = process.argv[1];
			const client = url.startsWith('https') ? https : http;
			client.get(url, { timeout: 7000 }, (res) => {
				let data = '';
				res.on('data', (c) => data += c);
				res.on('end', () => {
					try {
						const r = JSON.parse(data);
						const mapped = [];
						if (r.status === 'success' && Array.isArray(r.data)) {
							r.data.forEach(site => {
								if (site.ips && Array.isArray(site.ips)) {
									site.ips.forEach(ipInfo => {
										if (ipInfo.ip) mapped.push('http://' + ipInfo.ip + ':' + (ipInfo.port || 80));
									});
								}
							});
						}
						return process.stdout.write(JSON.stringify(mapped));
					} catch(e) {}
					process.stdout.write('[]');
				});
			}).on('error', () => process.stdout.write('[]'));
		`;
		const result = execFileSync(process.execPath, ['-e', script, apiUrl], {
			encoding: 'utf8',
			timeout: 9000,
			env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
		});
		const urls = JSON.parse(result);
		console.log('[Portal] Pre-fetched', urls.length, 'origins from API');
		return urls;
	} catch (e) {
		console.warn('[Portal] API prefetch failed:', e.message);
		return [];
	}
}

// 1. Load cache immediately (no network, instant)
let originsToWhitelist = loadCachedOrigins();

// 2. Try fresh API fetch; update cache and whitelist on success
const freshOrigins = prefetchSiteOrigins(API_BASE + '/sites');
if (freshOrigins.length > 0) {
	originsToWhitelist = freshOrigins;
	saveCachedOrigins(freshOrigins);
} else if (originsToWhitelist.length > 0) {
	console.log('[Portal] API unavailable — using cached origins for whitelist');
}

if (originsToWhitelist.length > 0) {
	app.commandLine.appendSwitch(
		'unsafely-treat-insecure-origin-as-secure',
		originsToWhitelist.join(',')
	);
	console.log('[Portal] Whitelisted', originsToWhitelist.length, 'secure origins');
} else {
	console.warn('[Portal] WARNING: No origins whitelisted — navigator.mediaDevices may be unavailable on HTTP sites');
}

let mainWindow;

// ── Window Creation ────────────────────────────────────────────
function createMainWindow() {
	mainWindow = new BrowserWindow({
		width: 1440,
		height: 900,
		minWidth: 1024,
		minHeight: 700,
		backgroundColor: '#060e1a',
		icon: path.join(__dirname, 'assets/icons/png/portal.png'),
		frame: false,
		show: false,
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			preload: path.join(__dirname, 'preload.js'),
		},
	});

	mainWindow.loadFile('index.html');
	mainWindow.setMenu(null);

	mainWindow.once('ready-to-show', () => {
		mainWindow.show();
		// mainWindow.webContents.openDevTools({ mode: 'detach' });
	});

	mainWindow.on('closed', () => {
		mainWindow = null;
	});
}

// ── API Helper ─────────────────────────────────────────────────
async function apiRequest(method, endpoint, body) {
	const url = API_BASE + endpoint;
	const opts = {
		method,
		headers: { 'Content-Type': 'application/json' },
	};
	if (body) opts.body = JSON.stringify(body);

	const res = await fetch(url, opts);
	const json = await res.json();
	if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
	return json;
}

// ── IPC: Read ──────────────────────────────────────────────────
ipcMain.handle('get-regions', () => apiRequest('GET', '/regions'));
ipcMain.handle('get-region-sites', (_, code) =>
	apiRequest('GET', `/regions/${code}/sites`)
);
ipcMain.handle('get-sites', (_, queryString) => {
	const ep = '/sites' + (queryString ? '?' + queryString : '');
	return apiRequest('GET', ep);
});
ipcMain.handle('get-apps', () => apiRequest('GET', '/apps'));
ipcMain.handle('get-app-sites', (_, appKey) =>
	apiRequest('GET', `/apps/${appKey}`)
);
ipcMain.handle('get-summary', () => apiRequest('GET', '/summary'));

// ── IPC: Cache Origins ─────────────────────────────────────────
ipcMain.handle('save-site-origins', (_, origins) => {
	if (Array.isArray(origins)) {
		saveCachedOrigins(origins);
		return true;
	}
	return false;
});

// ── IPC: Create / Update / Delete ──────────────────────────────
ipcMain.handle('create-region', (_, data) =>
	apiRequest('POST', '/regions', data)
);
ipcMain.handle('update-region', (_, code, data) =>
	apiRequest('PUT', `/regions/${code}`, data)
);
ipcMain.handle('delete-region', (_, code) =>
	apiRequest('DELETE', `/regions/${code}`)
);
ipcMain.handle('create-site', (_, data) =>
	apiRequest('POST', '/sites', data)
);
ipcMain.handle('update-site', (_, code, data) =>
	apiRequest('PUT', `/sites/${code}`, data)
);
ipcMain.handle('delete-site', (_, code) =>
	apiRequest('DELETE', `/sites/${code}`)
);

// ── IPC: Status check (HTTP HEAD) ─────────────────────────────
// Uses HTTP HEAD instead of TCP ping because:
// On Windows, TCP connect can succeed at OS routing level even when
// no web server is running (giving false "online"). HTTP HEAD
// actually verifies the web app is responding.
ipcMain.handle('check-site-status', (_, ip, port) => {
	return new Promise((resolve) => {
		const timeout = config.statusCheckTimeout || 3000;
		const start = Date.now();
		const p = parseInt(port) || 80;

		const req = http.request(
			{
				method: 'HEAD',
				host: ip,
				port: p,
				path: '/',
				timeout,
			},
			(res) => {
				const responseTime = Date.now() - start;
				// Any HTTP response (even 4xx/5xx) means server is running
				resolve({ online: true, responseTime });
				res.resume(); // consume response to free socket
			}
		);

		req.on('timeout', () => {
			req.destroy();
			resolve({ online: false, responseTime: timeout });
		});

		req.on('error', () => {
			resolve({ online: false, responseTime: Date.now() - start });
		});

		req.end();
	});
});

// ── IPC: Open site app in new window ───────────────────────────
// Architecture: load URL directly into BrowserWindow renderer.
// This avoids the webview sandbox layer which causes:
// 1. JS module MIME type errors (SW intercepts assets incorrectly)
// 2. WebRTC ICE failures (webview may not fully inherit Chromium flags)
ipcMain.handle('open-site-app', async (_, ip, port, siteName, appName) => {
	const url = `http://${ip}:${port}`;
	const title = `${appName} — ${siteName}`;

	const viewer = new BrowserWindow({
		width: 1280,
		height: 800,
		title,
		backgroundColor: '#0a0a0a',
		webPreferences: {
			contextIsolation: false,
			nodeIntegration: false,
			webSecurity: false,
			allowRunningInsecureContent: true,
			partition: 'persist:vcomm', // Separate session to avoid portal cache conflicts
		},
	});

	// Fix "MIME type text/html" error by clearing corrupt Service Worker / caches
	try {
		await viewer.webContents.session.clearStorageData({
			storages: ['serviceworkers', 'cachestorage']
		});
		await viewer.webContents.session.clearCache();
		console.log('[Portal:viewer] Cleared SW and cache for VComm session');
	} catch (err) {
		console.warn('[Portal:viewer] Cache clear warning:', err.message);
	}

	// Apply permissions BEFORE loading
	viewer.webContents.session.setPermissionRequestHandler((wc, permission, cb) => {
		console.log('[Portal:viewer] Permission granted:', permission);
		cb(true);
	});
	viewer.webContents.session.setPermissionCheckHandler(() => true);
	// Handle device permissions (camera/mic explicitly)
	viewer.webContents.session.setDevicePermissionHandler(() => true);

	// Apply WebRTC policy directly
	viewer.webContents.setWebRTCIPHandlingPolicy('default_public_and_private_interfaces');
	console.log('[Portal:viewer] WebRTC IP policy applied to viewer');

	// F12 to open DevTools manually
	viewer.webContents.on('before-input-event', (event, input) => {
		if (input.key === 'F12') {
			viewer.webContents.openDevTools({ mode: 'detach' });
		}
	});

	// Focus viewer after page loads so buttons are immediately clickable
	viewer.webContents.once('did-finish-load', () => {
		viewer.focus();
		viewer.webContents.focus();
		console.log('[Portal:viewer] Viewer focused after load');
		
		// Auto-open DevTools temporarily to debug
		viewer.webContents.openDevTools({ mode: 'detach' });
	});

	// Log errors from VComm app (all levels)
	viewer.webContents.on('console-message', (event, level, message) => {
		const labels = ['verbose', 'info', 'warn', 'error'];
		console.log(`[VComm:${labels[level] || level}] ${message}`);
	});

	viewer.webContents.on('did-fail-load', (event, errorCode, errorDesc, failedUrl) => {
		if (errorCode !== -3) {
			console.error(`[Portal:viewer] Load FAILED (${errorCode}): ${errorDesc} — ${failedUrl}`);
		}
	});

	viewer.loadURL(url);
	viewer.setMenu(null);

	return { success: true, url };
});

function escapeHtmlAttr(str) {
	return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


// ── IPC: Window controls ───────────────────────────────────────
ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-maximize', () => {
	if (mainWindow?.isMaximized()) mainWindow.unmaximize();
	else mainWindow?.maximize();
});
ipcMain.handle('window-close', () => mainWindow?.close());

// ── App Lifecycle ──────────────────────────────────────────────
app.whenReady().then(() => {
	// Grant permissions for ALL sessions — including webview sessions
	session.defaultSession.setPermissionRequestHandler(
		(webContents, permission, callback) => callback(true)
	);
	session.defaultSession.setPermissionCheckHandler(() => true);

	// Apply WebRTC policy & permissions to EVERY webContents created (BrowserWindow + webview)
	// This fires reliably for all webContents including those inside <webview> tags.
	// 'webview' type = the content inside <webview>
	// 'window' / 'browserView' type = BrowserWindow sub-frames (also needs policy for chat)
	app.on('web-contents-created', (event, contents) => {
		// Always grant permissions on the new contents' session
		contents.session.setPermissionRequestHandler((wc, permission, cb) => cb(true));
		contents.session.setPermissionCheckHandler(() => true);

		// Set WebRTC policy: expose real LAN IPs in ICE candidates
		// Without this, Chromium uses mDNS (.local) hostnames that mobile devices cannot resolve
		// causing 'connecting forever' on the remote side even though the call initiated.
		try {
			contents.setWebRTCIPHandlingPolicy('default_public_and_private_interfaces');
		} catch (e) {
			// some contents types don't support this — ignore safely
		}
		console.log(`[Portal] WebRTC policy + permissions applied to: ${contents.getType()}`);
	});

	createMainWindow();
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
	if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
