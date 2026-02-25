const { app, Menu, dialog } = require('electron');
const os = require('os');

// ============================================================================
// Helper: Build License Info Details
// ============================================================================

async function getLicenseDetails(appName, licenseManager) {
    try {
        const info = await licenseManager.getLicenseInfo();

        let statusIcon = '';
        let statusText = '';
        const status = info && info.status ? info.status : 'not_activated';

        switch (status) {
            case 'valid':
                statusIcon = '✅';
                statusText = 'AKTIF';
                break;
            case 'offline_valid':
                statusIcon = '🟡';
                statusText = 'AKTIF (Offline)';
                break;
            case 'grace_period':
                statusIcon = '⚠️';
                statusText = 'MASA TENGGANG';
                break;
            case 'expired':
                statusIcon = '❌';
                statusText = 'EXPIRED';
                break;
            case 'revoked':
                statusIcon = '🚫';
                statusText = 'DICABUT';
                break;
            case 'not_activated':
                statusIcon = '🔒';
                statusText = 'BELUM AKTIVASI';
                break;
            default:
                statusIcon = 'ℹ️';
                statusText = String(status).toUpperCase();
        }

        const licenseKey = info?.license?.licenseKey || info?.licenseKey || '-';
        const productCode = info?.license?.productCode || info?.productCode || '-';
        const hardwareId = info?.hardwareId || '-';

        let details = `Status  : ${statusIcon} ${statusText}\n`;
        details += `Produk  : ${productCode}\n`;
        details += `\nLicense Key:\n${licenseKey}\n`;
        details += `\nHardware ID:\n${hardwareId}`;

        if (info?.message && status !== 'valid') {
            details += `\n\nInfo: ${info.message}`;
        }

        return {
            isValid: status === 'valid' || status === 'offline_valid',
            details,
            statusText
        };
    } catch (err) {
        console.error('[Menu] getLicenseDetails error:', err);
        return {
            isValid: false,
            details: `Status: ❌ Gagal membaca lisensi\n\nError: ${err.message}`,
            statusText: 'ERROR'
        };
    }
}

// ============================================================================
// Helper: Show About Dialog (VSCode-style)
// ============================================================================

function showAboutDialog(mainWindow, opts) {
    const electronVersion = process.versions.electron;
    const nodeVersion = process.versions.node;
    const chromiumVersion = process.versions.chrome;
    const v8Version = process.versions.v8;
    const platform = `${os.type()} ${os.arch()} ${os.release()}`;

    const detail = [
        `Versi      : ${opts.version}`,
        `Produk     : ${opts.productName}`,
        ``,
        `Electron   : ${electronVersion}`,
        `Node.js    : ${nodeVersion}`,
        `Chromium   : ${chromiumVersion}`,
        `V8         : ${v8Version}`,
        `OS         : ${platform}`,
    ].join('\n');

    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: `About ${opts.appName}`,
        message: opts.appName,
        detail,
        buttons: ['OK'],
        icon: opts.iconPath || undefined
    });
}

// ============================================================================
// Menu Template
// ============================================================================

exports.createTemplate = (name, mainWindow) => {
    const { licenseManager } = require('./license');

    let template = [
        {
            label: 'Navigate',
            submenu: [
                {
                    label: 'Go to URL...',
                    accelerator: 'CmdOrCtrl+L',
                    click: async () => {
                        mainWindow.webContents.send('show-url-input-modal');
                    },
                },
                { type: 'separator' },
                {
                    label: 'Back',
                    accelerator: 'CmdOrCtrl+Left',
                    click: () => {
                        mainWindow.webContents.send('webview-go-back');
                    },
                },
                {
                    label: 'Forward',
                    accelerator: 'CmdOrCtrl+Right',
                    click: () => {
                        mainWindow.webContents.send('webview-go-forward');
                    },
                },
                {
                    label: 'Reload',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => {
                        mainWindow.webContents.send('webview-reload');
                    },
                },
                { type: 'separator' },
                {
                    label: 'Home',
                    accelerator: 'CmdOrCtrl+H',
                    click: () => {
                        mainWindow.webContents.send('webview-go-home');
                    },
                },
            ],
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'pasteandmatchstyle' },
                { role: 'delete' },
                { role: 'selectall' },
            ],
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forcereload' },
                { role: 'toggledevtools' },
                { type: 'separator' },
                { role: 'resetzoom' },
                { role: 'zoomin' },
                { role: 'zoomout' },
                { type: 'separator' },
                { role: 'togglefullscreen' },
            ],
        },
        {
            role: 'window',
            submenu: [{ role: 'minimize' }, { role: 'close' }],
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'View License',
                    accelerator: 'CmdOrCtrl+Shift+L',
                    click: async () => {
                        const { isValid, details } = await getLicenseDetails('EyeSee', licenseManager);
                        dialog.showMessageBox(mainWindow, {
                            type: isValid ? 'info' : 'warning',
                            title: 'Informasi Lisensi — EyeSee',
                            message: 'EyeSee License',
                            detail: details,
                            buttons: ['OK']
                        });
                    },
                },
                { type: 'separator' },
                {
                    label: 'About EyeSee',
                    click: () => {
                        const path = require('path');
                        showAboutDialog(mainWindow, {
                            appName: 'EyeSee',
                            productName: 'EyeSee Webview Application',
                            version: app.getVersion() || '1.0.0',
                            iconPath: path.join(__dirname, '../assets/icons/png/logo-eyesee.png')
                        });
                    },
                },
            ],
        },
    ];

    if (process.platform === 'darwin') {
        template.unshift({
            label: name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services', submenu: [] },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideothers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' },
            ],
        });

        template[2].submenu.push(
            { type: 'separator' },
            {
                label: 'Speech',
                submenu: [{ role: 'startspeaking' }, { role: 'stopspeaking' }],
            }
        );

        template[4].submenu = [
            { role: 'close' },
            { role: 'minimize' },
            { role: 'zoom' },
            { type: 'separator' },
            { role: 'front' },
        ];
    }

    return template;
};
