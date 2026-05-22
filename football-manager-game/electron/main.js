// Football Manager Chile — Electron Desktop App
// Run: npx electron . (requires: npm install --save-dev electron)
// Build: npm run desktop:dist

const { app, BrowserWindow, Menu, protocol } = require("electron");
const path = require("path");

// Enable custom protocol for local files (avoids webSecurity: false)
app.whenReady().then(() => {
  // Register file:// protocol handler so local HTML/JS/CSS loads correctly
  protocol.registerFileProtocol("app", (request, callback) => {
    const filePath = request.url.replace("app://", "");
    callback(path.join(__dirname, "..", filePath));
  });
  createWindow();
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: "Football Manager Chile",
    backgroundColor: "#0a1a0e",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // webSecurity enabled (do NOT set to false — security risk)
      // Local file loading works via file:// protocol
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
    {
      label: "Ver",
      submenu: [
        { role: "reload" },
        { role: "togglefullscreen" }
        // DevTools removed from release build
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
  return win;
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (require("electron").BrowserWindow.getAllWindows().length === 0) createWindow();
});
