import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, Plugin} from 'vite';

function centralSyncBridge(): Plugin {
  const syncFilePath = path.resolve(__dirname, '.sync_bridge.json');
  
  let syncState = {
    webhookUrl: '',
    spreadsheetId: '1h8ssmDEcV-PMGlkpOzfQCtlRpnoT0CBQQveT3e4wPfA',
    timeLogs: [] as any[],
    users: [] as any[],
  };

  try {
    if (fs.existsSync(syncFilePath)) {
      const data = JSON.parse(fs.readFileSync(syncFilePath, 'utf-8'));
      syncState = { ...syncState, ...data };
    }
  } catch (e) {}

  const saveSyncState = () => {
    try {
      fs.writeFileSync(syncFilePath, JSON.stringify(syncState, null, 2), 'utf-8');
    } catch (e) {}
  };

  return {
    name: 'central-sync-bridge',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const url = req.url.split('?')[0];

        if (url === '/api/config') {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                if (parsed.webhookUrl !== undefined) syncState.webhookUrl = parsed.webhookUrl;
                if (parsed.spreadsheetId !== undefined) syncState.spreadsheetId = parsed.spreadsheetId;
                saveSyncState();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, config: syncState }));
              } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
              }
            });
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            webhookUrl: syncState.webhookUrl,
            spreadsheetId: syncState.spreadsheetId
          }));
          return;
        }

        if (url === '/api/timelogs') {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const payload = JSON.parse(body);
                const logsToAdd = Array.isArray(payload) ? payload : [payload];
                const existingMap = new Map(syncState.timeLogs.map(l => [l.id, l]));
                for (const item of logsToAdd) {
                  if (item && item.id) {
                    existingMap.set(item.id, item);
                  }
                }
                syncState.timeLogs = Array.from(existingMap.values());
                saveSyncState();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, count: syncState.timeLogs.length }));
              } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
              }
            });
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(syncState.timeLogs));
          return;
        }

        if (url === '/api/users') {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const payload = JSON.parse(body);
                const usersToMerge = Array.isArray(payload) ? payload : [payload];
                const userMap = new Map(syncState.users.map(u => [u.id, u]));
                for (const u of usersToMerge) {
                  if (u && u.id) {
                    userMap.set(u.id, { ...(userMap.get(u.id) || {}), ...u });
                  }
                }
                syncState.users = Array.from(userMap.values());
                saveSyncState();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, count: syncState.users.length }));
              } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
              }
            });
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(syncState.users));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), centralSyncBridge()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
