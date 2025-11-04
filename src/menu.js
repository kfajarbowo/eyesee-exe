exports.createTemplate = (name, mainWindow) => {
  let template = [
    {
      label: "Navigate",
      submenu: [
        {
          label: "Go to URL...",
          accelerator: "CmdOrCtrl+L",
          click: async () => {
            const { ipcMain } = require('electron');
            const url = await mainWindow.webContents.executeJavaScript(`
              (async () => {
                return await window.electron.showUrlDialog();
              })()
            `);
            
            if (url) {
              mainWindow.webContents.send('navigate-webview', url);
            }
          }
        },
        { type: "separator" },
        {
          label: "Back",
          accelerator: "CmdOrCtrl+Left",
          click: () => {
            mainWindow.webContents.send('webview-go-back');
          }
        },
        {
          label: "Forward", 
          accelerator: "CmdOrCtrl+Right",
          click: () => {
            mainWindow.webContents.send('webview-go-forward');
          }
        },
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => {
            mainWindow.webContents.send('webview-reload');
          }
        },
        { type: "separator" },
        {
          label: "Home",
          accelerator: "CmdOrCtrl+H",
          click: () => {
            mainWindow.webContents.send('webview-go-home');
          }
        }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteandmatchstyle" },
        { role: "delete" },
        { role: "selectall" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forcereload" },
        { role: "toggledevtools" },
        { type: "separator" },
        { role: "resetzoom" },
        { role: "zoomin" },
        { role: "zoomout" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      role: "window",
      submenu: [{ role: "minimize" }, { role: "close" }],
    },
  ];

  if (process.platform === "darwin") {
    template.unshift({
      label: name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services", submenu: [] },
        { type: "separator" },
        { role: "hide" },
        { role: "hideothers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    });

    // Edit menu
    template[2].submenu.push(
      { type: "separator" },
      {
        label: "Speech",
        submenu: [{ role: "startspeaking" }, { role: "stopspeaking" }],
      }
    );

    // Window menu
    template[4].submenu = [
      { role: "close" },
      { role: "minimize" },
      { role: "zoom" },
      { type: "separator" },
      { role: "front" },
    ];
  }

  return template;
};
