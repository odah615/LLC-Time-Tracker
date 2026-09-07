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
    presence: {} as Record<string, any>,
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

        if (url === '/api/presence') {
          const now = Date.now();
          if (!syncState.presence) syncState.presence = {};

          // Auto-timeout sweep:
          // If inactive/heartbeat missing for > 10 mins -> offline (isOnline: false)
          // If inactive/heartbeat missing for > 2.5 mins -> idle (status: 'idle')
          for (const key of Object.keys(syncState.presence)) {
            const item = syncState.presence[key];
            if (item && item.isOnline) {
              const lastMs = item.lastHeartbeat ? new Date(item.lastHeartbeat).getTime() : 0;
              const diffMs = now - lastMs;
              if (diffMs > 10 * 60 * 1000) {
                item.isOnline = false;
                item.status = 'offline';
                item.isTracking = false;
                item.currentTask = 'Shift Concluded';
              } else if (diffMs > 2.5 * 60 * 1000 && !item.isPaused) {
                item.status = 'idle';
              }
            }
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const payload = JSON.parse(body);
                const itemsToMerge = Array.isArray(payload) ? payload : [payload];
                if (!syncState.presence) syncState.presence = {};
                for (const p of itemsToMerge) {
                  if (p && p.userId) {
                    const existing = syncState.presence[p.userId] || {};
                    syncState.presence[p.userId] = {
                      ...existing,
                      ...p,
                      lastHeartbeat: p.lastHeartbeat || new Date().toISOString(),
                    };
                  }
                }
                saveSyncState();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: true,
                  count: Object.keys(syncState.presence).length,
                  data: Object.values(syncState.presence),
                }));
              } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
              }
            });
            return;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(Object.values(syncState.presence)));
          return;
        }

        if (url === '/api/presence/reset' && req.method === 'POST') {
          syncState.presence = {};
          saveSyncState();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'All live presences reset' }));
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
