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
    badge: '.app / .sh',
    filename: 'Build_LLC_Time_Tracker_Mac.sh',
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

  if (os === 'windows') {
    const batContent = `@echo off
:: Force script to switch working directory to the folder containing this .bat file
cd /d "%~dp0"
title LLC Time Tracker Standalone Software Builder
cls
echo ========================================================
echo   LLC Time Tracker - Standalone Windows Desktop Builder
echo ========================================================
echo Working Directory: %cd%
echo.

echo [1/4] Generating desktop configuration...
(
echo {
echo   "name": "llc-time-tracker-desktop",
echo   "version": "1.0.0",
echo   "description": "LLC Time Tracker Desktop Software",
echo   "author": "LLC Time Tracker",
echo   "main": "main.js",
echo   "scripts": {
echo     "start": "electron .",
echo     "build": "electron-packager . \\"LLC Time Tracker\\" --platform=win32 --arch=x64 --overwrite --out=dist"
echo   },
echo   "devDependencies": {
echo     "electron": "^28.2.0",
echo     "electron-packager": "^17.1.2"
echo   }
echo }
) > package.json

echo [2/4] Generating main.js in %cd% ...
(
echo const { app, BrowserWindow } = require('electron'^);
echo const path = require('path'^);
echo.
echo function createWindow(^) {
echo   const mainWindow = new BrowserWindow({
echo     width: 1280,
echo     height: 840,
echo     minWidth: 400,
echo     minHeight: 600,
echo     title: 'LLC Time Tracker Desktop Software',
echo     autoHideMenuBar: true,
echo     webPreferences: {
echo       nodeIntegration: false,
echo       contextIsolation: true
echo     }
echo   }^);
echo.
echo   mainWindow.loadURL('${SOFTWARE_APP_URL}'^);
echo }
echo.
echo app.whenReady(^).then(createWindow^);
echo app.on('window-all-closed', (^) =^> { if (process.platform !== 'darwin'^) app.quit(^); }^);
) > main.js

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
cd "$(dirname "$0")"
echo "========================================================"
echo "  LLC Time Tracker - macOS (.app) Software Builder"
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
    "build": "electron-packager . \"LLC Time Tracker\" --platform=darwin --arch=x64,arm64 --overwrite --out=dist"
  },
  "devDependencies": {
    "electron": "^28.2.0",
    "electron-packager": "^17.1.2"
  }
}
EOF

echo "[2/4] Writing main.js..."
cat << 'EOF' > main.js
const { app, BrowserWindow } = require('electron');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 400,
    minHeight: 600,
    title: 'LLC Time Tracker Desktop Software',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
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
npm run build

# Also create an instant launch script for macOS users
cat << 'EOF' > Launch_LLC_Time_Tracker.command
#!/bin/bash
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
echo "SUCCESS! Your macOS Application is built!"
echo "Look inside folder:"
echo "  $(pwd)/dist/LLC Time Tracker-darwin-arm64/LLC Time Tracker.app"
echo "  or $(pwd)/dist/LLC Time Tracker-darwin-x64/LLC Time Tracker.app"
echo ""
echo "You can also double-click 'Launch_LLC_Time_Tracker.command' to start immediately!"
echo "========================================================"
`;
    const element = document.createElement('a');
    const file = new Blob([shContent], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'Build_LLC_Time_Tracker_Mac.sh';
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

echo "[2/4] Writing main.js..."
cat << 'EOF' > main.js
const { app, BrowserWindow } = require('electron');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 400,
    minHeight: 600,
    title: 'LLC Time Tracker Desktop Software',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
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
