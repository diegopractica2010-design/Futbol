// Football Manager Chile — Electron Desktop App
// Run: npx electron . (requires: npm install --save-dev electron)

const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: "Football Manager Chile",
    icon: path.join(__dirname, "../assets/favicon.svg"),
    backgroundColor: "#0a1a0e",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });

  win.loadFile(path.join(__dirname, "../index.html"));

  const menuTemplate = [
    {
      label: "Juego",
      submenu: [
        { label: "Pantalla completa", accelerator: "F11", click: () => win.setFullScreen(!win.isFullScreen()) },
        { type: "separator" },
        { label: "Salir", role: "quit" }
      ]
    },
    { label: "Ver", submenu: [{ role: "reload" }, { role: "toggleDevTools" }, { role: "togglefullscreen" }] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
  return win;
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (require("electron").BrowserWindow.getAllWindows().length === 0) createWindow();
});
