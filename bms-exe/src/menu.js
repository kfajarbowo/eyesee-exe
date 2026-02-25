const { app, Menu, dialog } = require('electron');
const os = require('os');
const path = require('path');

// ============================================================================
// Helper: Build License Info Details (async-safe)
// ============================================================================

async function getLicenseDetails(licenseManager) {
    try {
        const info = await licenseManager.getLicenseInfo();
        const status = info && info.status ? info.status : 'not_activated';

        let statusIcon = '';
        let statusText = '';
        switch (status) {
            case 'valid':         statusIcon = '✅'; statusText = 'AKTIF'; break;
            case 'offline_valid': statusIcon = '🟡'; statusText = 'AKTIF (Offline)'; break;
            case 'grace_period':  statusIcon = '⚠️'; statusText = 'MASA TENGGANG'; break;
            case 'expired':       statusIcon = '❌'; statusText = 'EXPIRED'; break;
            case 'revoked':       statusIcon = '🚫'; statusText = 'DICABUT'; break;
            case 'not_activated': statusIcon = '🔒'; statusText = 'BELUM AKTIVASI'; break;
            default:              statusIcon = 'ℹ️'; statusText = String(status).toUpperCase();
        }

        const licenseKey  = info?.license?.licenseKey  || info?.licenseKey  || '-';
        const productCode = info?.license?.productCode || info?.productCode || '-';
        const hardwareId  = info?.hardwareId || '-';

        let details = `Status  : ${statusIcon} ${statusText}\n`;
        details += `Produk  : ${productCode}\n`;
        details += `\nLicense Key:\n${licenseKey}\n`;
        details += `\nHardware ID:\n${hardwareId}`;
        if (info?.message && status !== 'valid') details += `\n\nInfo: ${info.message}`;

        return { isValid: status === 'valid' || status === 'offline_valid', details };
    } catch (err) {
        return { isValid: false, details: `Status: ❌ Gagal membaca lisensi\n\nError: ${err.message}` };
    }
}

// ============================================================================
// Helper: Show About Dialog (VSCode-style)
// ============================================================================

function showAboutDialog(mainWindow, opts) {
    const detail = [
        `Versi      : ${opts.version}`,
        `Produk     : ${opts.productName}`,
        ``,
        `Electron   : ${process.versions.electron}`,
        `Node.js    : ${process.versions.node}`,
        `Chromium   : ${process.versions.chrome}`,
        `V8         : ${process.versions.v8}`,
        `OS         : ${os.type()} ${os.arch()} ${os.release()}`,
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
// Create Menu
// ============================================================================

function createMenu(mainWindow) {
    const { licenseManager } = require('./license');

    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Quit',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => { app.quit(); },
                },
            ],
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo',      label: 'Undo'       },
                { role: 'redo',      label: 'Redo'       },
                { type: 'separator' },
                { role: 'cut',       label: 'Cut'        },
                { role: 'copy',      label: 'Copy'       },
                { role: 'paste',     label: 'Paste'      },
                { role: 'selectAll', label: 'Select All' },
            ],
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload',          label: 'Reload'                    },
                { role: 'forceReload',     label: 'Force Reload'              },
                { role: 'toggleDevTools',  label: 'Toggle Developer Tools'    },
                { type: 'separator' },
                { role: 'resetZoom',       label: 'Actual Size'               },
                { role: 'zoomIn',          label: 'Zoom In'                   },
                { role: 'zoomOut',         label: 'Zoom Out'                  },
                { type: 'separator' },
                { role: 'togglefullscreen', label: 'Toggle Fullscreen'        },
            ],
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize', label: 'Minimize' },
                { role: 'close',    label: 'Close'    },
            ],
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'View License',
                    accelerator: 'CmdOrCtrl+Shift+L',
                    click: async () => {
                        const { isValid, details } = await getLicenseDetails(licenseManager);
                        dialog.showMessageBox(mainWindow, {
                            type: isValid ? 'info' : 'warning',
                            title: 'Informasi Lisensi — BMS',
                            message: 'BMS License',
                            detail: details,
                            buttons: ['OK']
                        });
                    },
                },
                { type: 'separator' },
                {
                    label: 'About BMS',
                    click: () => {
                        showAboutDialog(mainWindow, {
                            appName: 'BMS',
                            productName: 'BMS Application',
                            version: app.getVersion() || '1.0.0',
                            iconPath: path.join(__dirname, '../assets/icons/png/logo-bms.png')
                        });
                    },
                },
            ],
        },
    ];

    // macOS adjustments
    if (process.platform === 'darwin') {
        template.unshift({
            label: app.getName(),
            submenu: [
                { role: 'about',      label: 'About ' + app.getName() },
                { type: 'separator' },
                { role: 'services',   label: 'Services'               },
                { type: 'separator' },
                { role: 'hide',       label: 'Hide ' + app.getName() },
                { role: 'hideOthers', label: 'Hide Others'            },
                { role: 'unhide',     label: 'Show All'               },
                { type: 'separator' },
                { role: 'quit',       label: 'Quit ' + app.getName() },
            ],
        });

        template[4].submenu = [
            { role: 'close',    label: 'Close'               },
            { role: 'minimize', label: 'Minimize'            },
            { role: 'zoom',     label: 'Zoom'                },
            { type: 'separator' },
            { role: 'front',    label: 'Bring All to Front'  },
        ];
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

module.exports = { createMenu };
