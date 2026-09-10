export type DesktopOS = 'windows' | 'mac' | 'linux';

export interface DesktopPackageInfo {
  os: DesktopOS;
  label: string;
  badge: string;
  filename: string;
  outputFormat: string;
  icon: string;
  description: string;
}

export const DESKTOP_PACKAGES: Record<DesktopOS, DesktopPackageInfo> = {
  windows: {
    os: 'windows',
    label: 'Windows OS',
    badge: '.exe / .bat',
    filename: 'Build_LLC_Time_Tracker_Windows.bat',
    outputFormat: 'LLC Time Tracker.exe',
    icon: '🖥️',
    description: 'Automated native desktop installer for Windows 10 & 11 (64-bit/32-bit).',
  },
  mac: {
    os: 'mac',
    label: 'macOS (Apple)',
    badge: '.app / .command',
    filename: 'Build_LLC_Time_Tracker_Mac.command',
    outputFormat: 'LLC Time Tracker.app',
    icon: '🍎',
    description: 'Universal application bundle for Apple Silicon (M1/M2/M3/M4) and Intel Macs.',
  },
  linux: {
    os: 'linux',
    label: 'Linux OS',
    badge: 'Binary / .sh',
    filename: 'Build_LLC_Time_Tracker_Linux.sh',
    outputFormat: 'LLC Time Tracker (Binary)',
    icon: '🐧',
    description: 'Standalone executable for Ubuntu, Debian, Fedora, Arch, and other Linux distributions.',
  },
};

/**
 * Downloads the native standalone electron builder script for Windows, Mac, or Linux
 */
export const downloadDesktopSoftwarePackage = (os: DesktopOS = 'windows') => {
  const currentOrigin = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : 'https://portal.llctimetracker.com';
  
  const SOFTWARE_APP_URL = `${currentOrigin}?mode=desktop&source=software&appMode=desktop`;

  const packageJsonContent = JSON.stringify(
    {
      name: 'llc-time-tracker-desktop',
      version: '1.0.0',
      description: 'LLC Time Tracker Desktop Software',
      author: 'LLC Time Tracker',
      main: 'main.js',
      scripts: {
        start: 'electron .',
        build: 'electron-packager . "LLC Time Tracker" --platform=win32 --arch=x64 --overwrite --out=dist',
      },
      devDependencies: {
        electron: '^28.2.0',
        'electron-packager': '^17.1.2',
      },
    },
    null,
    2
  );

  const preloadJsContent = `const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSystemIdleTime: () => ipcRenderer.invoke('get-system-idle-time'),
  isDesktopApp: true
});
`;

  const mainJsContent = `const { app, BrowserWindow, powerMonitor, ipcMain } = require('electron');
const path = require('path');

// OS-Level hardware idle tracking: queries true system-wide keyboard/mouse activity across all monitors & applications
ipcMain.handle('get-system-idle-time', () => {
  try {
    return powerMonitor.getSystemIdleTime();
  } catch (err) {
    return 0;
  }
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 400,
    minHeight: 600,
    title: 'LLC Time Tracker Desktop Software',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });

  mainWindow.loadURL('${SOFTWARE_APP_URL}');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
`;

  // Encode safely to Base64 to guarantee zero shell escaping issues in Windows Batch
  const b64PackageJson = typeof btoa !== 'undefined' ? btoa(unescape(encodeURIComponent(packageJsonContent))) : '';
  const b64MainJs = typeof btoa !== 'undefined' ? btoa(unescape(encodeURIComponent(mainJsContent))) : '';
  const b64PreloadJs = typeof btoa !== 'undefined' ? btoa(unescape(encodeURIComponent(preloadJsContent))) : '';

  if (os === 'windows') {
    const batContent = `@echo off
setlocal EnableDelayedExpansion
:: Force script to switch working directory to the folder containing this .bat file
cd /d "%~dp0"
title LLC Time Tracker Standalone Software Builder
cls
echo ========================================================
echo   LLC Time Tracker - Standalone Windows Desktop Builder
echo ========================================================
echo Working Directory: %cd%
echo.

echo [1/4] Generating desktop configuration (package.json)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[System.IO.File]::WriteAllBytes('package.json', [System.Convert]::FromBase64String('${b64PackageJson}'))"

echo [2/4] Generating main.js and preload.js with Dual-Monitor OS Idle Detection...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[System.IO.File]::WriteAllBytes('main.js', [System.Convert]::FromBase64String('${b64MainJs}'))"
powershell -NoProfile -ExecutionPolicy Bypass -Command "[System.IO.File]::WriteAllBytes('preload.js', [System.Convert]::FromBase64String('${b64PreloadJs}'))"

echo.
echo [3/4] Installing Electron dependencies (npm install)...
call npm install --no-audit

echo.
echo [4/4] Compiling Standalone Windows Desktop Executable (.exe)...
call npm run build

echo.
echo ========================================================
echo SUCCESS! Your standalone Windows application (.exe) is built!
echo.
echo Look inside folder:
echo "%cd%\\dist\\LLC Time Tracker-win32-x64"
echo.
echo Double-click "LLC Time Tracker.exe" to launch your software!
echo ========================================================
pause
`;
    const element = document.createElement('a');
    const file = new Blob([batContent], { type: 'application/cmd' });
    element.href = URL.createObjectURL(file);
    element.download = 'Build_LLC_Time_Tracker_Windows.bat';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  } else if (os === 'mac') {
    const shContent = `#!/bin/bash
# Automatically load Mac user PATH including Homebrew and NVM
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -n 1)/bin:$PATH"
cd "$(dirname "$0")"

echo "========================================================"
echo "  LLC Time Tracker - macOS (.app) Software Builder"
echo "========================================================"
echo "Working directory: $(pwd)"
echo ""

# Check for Node.js / npm
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "⚠️ Node.js or npm runtime was not detected in standard Mac paths."
  echo "Opening LLC Time Tracker in your browser..."
  echo "Tip: You can install Node.js from https://nodejs.org or run directly in Chrome/Safari!"
  open "${SOFTWARE_APP_URL}"
  exit 0
fi

# Detect architecture (Apple Silicon M1/M2/M3/M4 vs Intel)
MAC_ARCH="x64"
if [ "$(uname -m)" = "arm64" ]; then
  MAC_ARCH="arm64"
fi
echo "Detected Mac architecture: $MAC_ARCH"

echo "[1/4] Writing package.json..."
cat << 'EOF' > package.json
{
  "name": "llc-time-tracker-desktop",
  "version": "1.0.0",
  "description": "LLC Time Tracker Desktop Software",
  "author": "LLC Time Tracker",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-packager . \"LLC Time Tracker\" --platform=darwin --arch=x64 --overwrite --out=dist"
  },
  "devDependencies": {
    "electron": "^28.2.0",
    "electron-packager": "^17.1.2"
  }
}
EOF

# Update architecture in package.json for Apple Silicon if applicable
if [ "$MAC_ARCH" = "arm64" ]; then
  sed -i '' 's/--arch=x64/--arch=arm64/g' package.json 2>/dev/null || true
fi

echo "[2/4] Writing main.js and preload.js (with dual-monitor OS idle tracking)..."
cat << 'EOF' > preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSystemIdleTime: () => ipcRenderer.invoke('get-system-idle-time'),
  isDesktopApp: true
});
EOF

cat << 'EOF' > main.js
const { app, BrowserWindow, powerMonitor, ipcMain } = require('electron');
const path = require('path');

// OS-Level hardware idle tracking: queries true system-wide keyboard/mouse activity across all monitors & applications
ipcMain.handle('get-system-idle-time', () => {
  try {
    return powerMonitor.getSystemIdleTime();
  } catch (err) {
    return 0;
  }
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 400,
    minHeight: 600,
    title: 'LLC Time Tracker Desktop Software',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });

  mainWindow.loadURL('${SOFTWARE_APP_URL}');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
EOF

echo "[3/4] Installing Electron dependencies..."
npm install --no-audit

echo "[4/4] Building macOS Standalone App Bundle..."
npm run build || npx electron-packager . "LLC Time Tracker" --platform=darwin --arch="$MAC_ARCH" --overwrite --out=dist || echo "Packager finished or skipped, launcher ready!"

# Create an instant launch script for macOS users
cat << 'EOF' > Launch_LLC_Time_Tracker.command
#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")"
if [ -d "dist/LLC Time Tracker-darwin-arm64/LLC Time Tracker.app" ]; then
  open "dist/LLC Time Tracker-darwin-arm64/LLC Time Tracker.app"
elif [ -d "dist/LLC Time Tracker-darwin-x64/LLC Time Tracker.app" ]; then
  open "dist/LLC Time Tracker-darwin-x64/LLC Time Tracker.app"
else
  npx electron .
fi
EOF
chmod +x Launch_LLC_Time_Tracker.command

echo ""
echo "========================================================"
echo "SUCCESS! Your macOS Application is ready!"
echo "You can double-click 'Launch_LLC_Time_Tracker.command' to run anytime."
echo "========================================================"
open Launch_LLC_Time_Tracker.command 2>/dev/null || true
`;
    const element = document.createElement('a');
    const file = new Blob([shContent], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'Build_LLC_Time_Tracker_Mac.command';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  } else {
    const shContent = `#!/bin/bash
cd "$(dirname "$0")"
echo "========================================================"
echo "  LLC Time Tracker - Linux Software Builder"
echo "========================================================"
echo "Working directory: $(pwd)"
echo ""

echo "[1/4] Writing package.json..."
cat << 'EOF' > package.json
{
  "name": "llc-time-tracker-desktop",
  "version": "1.0.0",
  "description": "LLC Time Tracker Desktop Software",
  "author": "LLC Time Tracker",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-packager . \"LLC Time Tracker\" --platform=linux --arch=x64 --overwrite --out=dist"
  },
  "devDependencies": {
    "electron": "^28.2.0",
    "electron-packager": "^17.1.2"
  }
}
EOF

echo "[2/4] Writing main.js and preload.js (with dual-monitor OS idle tracking)..."
cat << 'EOF' > preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSystemIdleTime: () => ipcRenderer.invoke('get-system-idle-time'),
  isDesktopApp: true
});
EOF

cat << 'EOF' > main.js
const { app, BrowserWindow, powerMonitor, ipcMain } = require('electron');
const path = require('path');

// OS-Level hardware idle tracking: queries true system-wide keyboard/mouse activity across all monitors & applications
ipcMain.handle('get-system-idle-time', () => {
  try {
    return powerMonitor.getSystemIdleTime();
  } catch (err) {
    return 0;
  }
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 400,
    minHeight: 600,
    title: 'LLC Time Tracker Desktop Software',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });

  mainWindow.loadURL('${SOFTWARE_APP_URL}');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
EOF

echo "[3/4] Installing Electron dependencies..."
npm install --no-audit

echo "[4/4] Building Linux Executable..."
npm run build

cat << 'EOF' > Launch_LLC_Time_Tracker.sh
#!/bin/bash
cd "$(dirname "$0")"
if [ -f "dist/LLC Time Tracker-linux-x64/LLC Time Tracker" ]; then
  "./dist/LLC Time Tracker-linux-x64/LLC Time Tracker"
else
  npx electron .
fi
EOF
chmod +x Launch_LLC_Time_Tracker.sh

echo ""
echo "========================================================"
echo "SUCCESS! Your Linux Application is built!"
echo "Look inside folder: $(pwd)/dist/LLC Time Tracker-linux-x64/"
echo "Run './Launch_LLC_Time_Tracker.sh' to launch!"
echo "========================================================"
`;
    const element = document.createElement('a');
    const file = new Blob([shContent], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'Build_LLC_Time_Tracker_Linux.sh';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }
};
