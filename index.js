const {
  app,
  BrowserWindow,
  ipcMain
} = require("electron");

// if reload is a cmd line argument
if (process.argv.slice(2) == "reload")
  // hot reloading for electron.
  require("electron-reload")(__dirname);


let mainWindow;

app.on("ready", () => {
  const screen = require("electron").screen;
  const {
    width,
    height
  } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    height: height - 150,
    width: width - 300,
    center: true,
    frame: false,
    icon: "assets/icon.png",
    contentSecurityPolicy: {
      "script-src": "self"
    },
    webPreferences: {
      nodeIntegration: true
    }
  });


  mainWindow.loadURL("file://" + __dirname + "/index.html");

  ipcMain.on('get-path', (event, arg) => {
    event.returnValue = app.getAppPath();
  })


  ipcMain.on('close-window', (event, arg) => {
    mainWindow.close();
  })

  ipcMain.on('minimize-window', (event, arg) => {
    mainWindow.minimize();
  })

});