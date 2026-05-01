const { app, BrowserWindow, utilityProcess } = require('electron');
const path = require('path');

let mainWindow;
let backendProcess;

function startBackend() {
    try {
        // Run the backend directly in the main process for maximum compatibility
        require('./backend/server.js');
        console.log('Backend started via require');
    } catch (err) {
        console.error('Failed to start backend:', err);
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
        title: "LaTeX Studio Pro"
    });

    // Remove menu for a cleaner native look
    mainWindow.setMenuBarVisibility(false);

    // Wait for the backend to start with retry logic
    const loadUrl = () => {
        if (!mainWindow) return;
        mainWindow.loadURL('http://localhost:3001').catch(() => {
            setTimeout(loadUrl, 1000);
        });
    };
    
    loadUrl();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}


app.on('ready', () => {
    startBackend();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (backendProcess) backendProcess.kill();
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
