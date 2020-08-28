const {
  app,
  BrowserWindow
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
});