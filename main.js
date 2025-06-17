const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let oauthWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false, // Allow localhost requests for OAuth callback
    },
  });

  mainWindow.loadFile('index.html');

  // Open DevTools for debugging
  //mainWindow.webContents.openDevTools();

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Optional: Open DevTools in development
  // mainWindow.webContents.openDevTools();
}

// Handle OAuth window creation from renderer
ipcMain.handle('create-oauth-window', async (event, authUrl) => {
  console.log('Main: Received OAuth window creation request for URL:', authUrl);
  
  return new Promise((resolve, reject) => {
    // Close existing window if open
    if (oauthWindow && !oauthWindow.isDestroyed()) {
      console.log('Main: Closing existing OAuth window');
      oauthWindow.close();
    }
    
    console.log('Main: Creating new OAuth window');
    oauthWindow = new BrowserWindow({
      width: 600,
      height: 800,
      show: false, // Don't show until ready
      modal: true,
      parent: mainWindow,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true
      }
    });

    // Show window once it's ready
    oauthWindow.once('ready-to-show', () => {
      console.log('Main: OAuth window ready, showing window');
      oauthWindow.show();
    });

    // Handle load failures
    oauthWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('Main: OAuth window failed to load:', errorCode, errorDescription, validatedURL);
      if (oauthWindow && !oauthWindow.isDestroyed()) {
        oauthWindow.close();
      }
      resolve({ type: 'error', error: `Failed to load: ${errorDescription}` });
    });

    // Handle successful load
    oauthWindow.webContents.on('did-finish-load', () => {
      console.log('Main: OAuth window loaded successfully');
    });

    // Handle page title updates
    oauthWindow.on('page-title-updated', (event, title) => {
      console.log('Main: OAuth window title updated:', title);
    });

    // Load the URL with error handling
    console.log('Main: Loading URL in OAuth window:', authUrl);
    oauthWindow.loadURL(authUrl)
      .then(() => {
        console.log('Main: URL load initiated successfully');
      })
      .catch(error => {
        console.error('Main: Error loading OAuth URL:', error);
        resolve({ type: 'error', error: error.message });
      });
    
    // Handle window closed
    oauthWindow.on('closed', () => {
      console.log('Main: OAuth window closed');
      oauthWindow = null;
      resolve({ type: 'window-closed' });
    });

    // Monitor URL changes
    const handleNavigation = (event, url) => {
      console.log('Main: OAuth window navigating to:', url);
      
      if (url.startsWith('http://localhost:3000/callback')) {
        console.log('Main: Callback URL detected');
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get('code');
        const state = urlObj.searchParams.get('state');
        const error = urlObj.searchParams.get('error');
        
        console.log('Main: Callback parameters:', { code: !!code, state: !!state, error });
        
        // Close window
        if (oauthWindow && !oauthWindow.isDestroyed()) {
          oauthWindow.close();
        }
        
        if (error) {
          resolve({ type: 'error', error });
        } else if (code && state) {
          resolve({ type: 'success', code, state });
        } else {
          resolve({ type: 'error', error: 'No code or state received' });
        }
      }
    };

    oauthWindow.webContents.on('will-redirect', handleNavigation);
    oauthWindow.webContents.on('did-navigate', handleNavigation);
    oauthWindow.webContents.on('did-navigate-in-page', handleNavigation);
    
    // Add timeout to prevent hanging
    setTimeout(() => {
      if (oauthWindow && !oauthWindow.isDestroyed()) {
        console.log('Main: OAuth window timeout after 60 seconds');
        oauthWindow.close();
        resolve({ type: 'error', error: 'OAuth window timeout' });
      }
    }, 60000); // 60 second timeout
  });
});

// Handle OAuth window closing from renderer
ipcMain.handle('close-oauth-window', async () => {
  if (oauthWindow && !oauthWindow.isDestroyed()) {
    oauthWindow.close();
    oauthWindow = null;
  }
});

// Handle OAuth callback URLs
app.setAsDefaultProtocolClient('api-tester');

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Handle protocol for OAuth callbacks (alternative method)
app.on('open-url', (event, url) => {
  console.log('Protocol URL:', url);
});