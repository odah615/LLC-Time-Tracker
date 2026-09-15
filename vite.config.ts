import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, Plugin} from 'vite';

function deduplicateUsersHelper(rawUsers: any[]): any[] {
  if (!Array.isArray(rawUsers) || rawUsers.length === 0) return [];
  const nameMap = new Map<string, number>();
  const codeMap = new Map<string, number>();
  const numCodeMap = new Map<string, number>();
  const emailMap = new Map<string, number>();
  const userMap = new Map<string, number>();
  const idMap = new Map<string, number>();
  const result: any[] = [];

  const isPlaceholderName = (name?: string, username?: string, employeeCode?: string) => {
    if (!name && !username) return true;
    const cleanName = (name || '').trim();
    const cleanUser = (username || '').trim();
    const cleanCode = (employeeCode || '').trim().toUpperCase();

    if (
      cleanName.toLowerCase() === 'agent_admin' ||
      cleanName.toLowerCase() === 'agent admin' ||
      cleanName.toLowerCase() === 'team_leader1' ||
      cleanName.toLowerCase() === 'team leader 1' ||
      cleanUser.toLowerCase() === 'agentadm' ||
      cleanUser.toLowerCase() === 'teamlead' ||
      cleanCode === 'LLC-0001' ||
      cleanCode === 'LLC-0002'
    ) {
      return true;
    }

    const isGenericAgent = /^Agent[_\s\-]?\d+$/i.test(cleanName) || /^Agent[_\s\-]?\d+$/i.test(cleanUser);
    const isGenericTrainee = /^Trainee[_\s\-]?\d+$/i.test(cleanName) || /^Trainee[_\s\-]?\d+$/i.test(cleanUser);
    const isGenericEmployee = /^Employee[_\s\-]?\d+$/i.test(cleanName) || /^Employee[_\s\-]?LLC/i.test(cleanName);
    const isGenericUser = /^User[_\s\-]?\d+$/i.test(cleanName);

    return isGenericAgent || isGenericTrainee || isGenericEmployee || isGenericUser;
  };

  for (const u of rawUsers) {
    if (!u) continue;
    const isSuperAdmin =
      u.employeeCode?.toLowerCase() === 'superadmin' ||
      u.id === 'usr-superadmin-red' ||
      u.id === 'usr-superadmin-root' ||
      u.email?.toLowerCase() === 'admin@llc.com' ||
      (u.role === 'admin' && (u.name === 'Admin' || u.name === 'Red'));

    if (isSuperAdmin) {
      const existingAdminIdx = result.findIndex(
        (x) => x.employeeCode?.toLowerCase() === 'superadmin' || x.id === 'usr-superadmin-red'
      );
      const canonicalAdmin = {
        ...u,
        id: 'usr-superadmin-red',
        employeeCode: 'SuperAdmin',
        email: 'admin@llc.com',
        name: u.name === 'Red' ? 'Red' : 'Admin',
        role: 'admin',
        designation: 'Admin',
        username: u.username || 'admin',
      };
      if (existingAdminIdx >= 0) {
        result[existingAdminIdx] = { ...result[existingAdminIdx], ...canonicalAdmin };
      } else {
        result.unshift(canonicalAdmin);
      }
      continue;
    }

    const isTrainer =
      u.employeeCode?.toUpperCase() === 'LLC-0003' ||
      u.email?.toLowerCase() === 'piaodahcam@gmail.com' ||
      u.id === 'usr-llc-0003' ||
      u.name?.toLowerCase().trim() === 'pia' ||
      (u.designation?.toLowerCase().includes('trainer') && u.role === 'trainer');

    if (isTrainer) {
      const existingTrainerIdx = result.findIndex(
        (x) =>
          x.employeeCode?.toUpperCase() === 'LLC-0003' ||
          x.email?.toLowerCase() === 'piaodahcam@gmail.com' ||
          x.id === 'usr-llc-0003' ||
          x.name?.toLowerCase().trim() === 'pia'
      );
      const canonicalTrainer = {
        ...u,
        id: 'usr-llc-0003',
        employeeCode: 'LLC-0003',
        email: 'piaodahcam@gmail.com',
        name: 'Pia',
        role: 'trainer',
        designation: 'Trainer',
        username: 'trainer',
        department: 'Training',
      };
      if (existingTrainerIdx >= 0) {
        result[existingTrainerIdx] = { ...result[existingTrainerIdx], ...canonicalTrainer };
      } else {
        result.push(canonicalTrainer);
      }
      continue;
    }

    if (isPlaceholderName(u.name, u.username, u.employeeCode)) {
      continue;
    }

    const normName = (u.name || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    const normCode = (u.employeeCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
    const numOnlyCode = normCode.replace(/^[A-Z]+/, '');
    const normEmail = (u.email || '').toLowerCase().trim();
    const normUsername = (u.username || '').toLowerCase().trim();
    const rawId = (u.id || '').trim();

    let existingIndex = -1;
    if (normName && nameMap.has(normName)) {
      existingIndex = nameMap.get(normName)!;
    } else if (normCode && codeMap.has(normCode)) {
      existingIndex = codeMap.get(normCode)!;
    } else if (numOnlyCode && numCodeMap.has(numOnlyCode)) {
      existingIndex = numCodeMap.get(numOnlyCode)!;
    } else if (normEmail && emailMap.has(normEmail)) {
      existingIndex = emailMap.get(normEmail)!;
    } else if (normUsername && userMap.has(normUsername)) {
      existingIndex = userMap.get(normUsername)!;
    } else if (rawId && idMap.has(rawId)) {
      existingIndex = idMap.get(rawId)!;
    }

    if (existingIndex >= 0) {
      const existing = result[existingIndex];
      const merged = {
        ...existing,
        ...u,
        name: existing.name || u.name,
        employeeCode: existing.employeeCode || u.employeeCode,
        username: existing.username || u.username,
        email: existing.email || u.email,
        role: existing.role && existing.role !== 'agent' ? existing.role : (u.role || 'agent'),
        designation: existing.designation || u.designation || 'Agent',
        department: existing.department || u.department || 'Operations',
        teamLeaderId: existing.teamLeaderId || u.teamLeaderId || 'usr-llc-0003',
        password: existing.password && existing.password !== 'Password123!' ? existing.password : u.password || existing.password || 'Password123!',
        customPermissions: existing.customPermissions || u.customPermissions,
      };
      result[existingIndex] = merged;
    } else {
      const newIndex = result.length;
      result.push(u);
      if (normName) nameMap.set(normName, newIndex);
      if (normCode) codeMap.set(normCode, newIndex);
      if (numOnlyCode) numCodeMap.set(numOnlyCode, newIndex);
      if (normEmail) emailMap.set(normEmail, newIndex);
      if (normUsername) userMap.set(normUsername, newIndex);
      if (rawId) idMap.set(rawId, newIndex);
    }
  }
  return result;
}

function centralSyncBridge(): Plugin {
  const syncFilePath = path.resolve(__dirname, '.sync_bridge.json');
  
  let syncState = {
    webhookUrl: '',
    spreadsheetId: '1h8ssmDEcV-PMGlkpOzfQCtlRpnoT0CBQQveT3e4wPfA',
    timeLogs: [] as any[],
    users: [] as any[],
    presence: {} as Record<string, any>,
    auditLogs: [] as any[],
    attendance: [] as any[],
  };

  try {
    if (fs.existsSync(syncFilePath)) {
      const data = JSON.parse(fs.readFileSync(syncFilePath, 'utf-8'));
      syncState = { ...syncState, ...data };
      syncState.users = deduplicateUsersHelper(syncState.users);
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
      server.middlewares.use(async (req, res, next) => {
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

        if (url === '/api/sync-sheets') {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body);
                const webhookUrl = parsed?.webhookUrl;
                const payload = parsed?.payload;

                if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.trim().startsWith('https://') || webhookUrl.includes('...')) {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: false, message: 'Invalid or placeholder Webhook URL' }));
                  return;
                }

                // Node fetch automatically follows Google Apps Script 302 redirects and bypasses browser CORS restrictions
                const gResp = await fetch(webhookUrl.trim(), {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                  },
                  body: JSON.stringify(payload),
                  redirect: 'follow',
                });

                let responseText = '';
                try {
                  responseText = await gResp.text();
                } catch (e) {}

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: gResp.ok || gResp.status < 400,
                  status: gResp.status,
                  message: 'Successfully forwarded to Google Sheets webhook',
                  details: responseText,
                }));
              } catch (err: any) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: false,
                  message: err?.message || 'Server proxy failed',
                }));
              }
            });
            return;
          }

          if (req.method === 'GET') {
            const parsedUrl = new URL(req.url || '', 'http://localhost:3000');
            const targetUrl = parsedUrl.searchParams.get('url');
            if (!targetUrl || !targetUrl.startsWith('https://') || targetUrl.includes('...')) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, message: 'Invalid target URL' }));
              return;
            }
            try {
              const gResp = await fetch(targetUrl, {
                method: 'GET',
                redirect: 'follow',
              });
              const json = await gResp.json();
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(json));
            } catch (err: any) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, message: err?.message || 'Proxy GET failed' }));
            }
            return;
          }
        }

        function formatPhtTime(isoStr?: string) {
          if (!isoStr) return '';
          try {
            const d = new Date(isoStr);
            if (isNaN(d.getTime())) return '';
            return new Intl.DateTimeFormat('en-US', {
              timeZone: 'Asia/Manila',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            }).format(d);
          } catch {
            return '';
          }
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
                    if (!item.date && item.startTime) {
                      item.date = item.startTime.split('T')[0];
                    }
                    if (item.startTime) {
                      const pht = formatPhtTime(item.startTime);
                      if (pht) item.geoLocalStartTime = pht;
                    }
                    if (!item.geoTimezone) item.geoTimezone = 'Asia/Manila';
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

          // Ensure all returned logs have accurate geoLocalStartTime computed from startTime
          const sanitizedLogs = (syncState.timeLogs || []).map(l => {
            if (l.startTime) {
              const pht = formatPhtTime(l.startTime);
              if (pht) return { ...l, geoLocalStartTime: pht, geoTimezone: l.geoTimezone || 'Asia/Manila' };
            }
            return l;
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(sanitizedLogs));
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
                syncState.users = deduplicateUsersHelper([...syncState.users, ...usersToMerge]);
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

        if (url === '/api/auditlogs') {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const payload = JSON.parse(body);
                const logsToAdd = Array.isArray(payload) ? payload : [payload];
                if (!syncState.auditLogs) syncState.auditLogs = [];
                const existingMap = new Map(syncState.auditLogs.map(l => [l.id, l]));
                for (const item of logsToAdd) {
                  if (item && item.id) {
                    existingMap.set(item.id, item);
                  }
                }
                syncState.auditLogs = Array.from(existingMap.values())
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                saveSyncState();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, count: syncState.auditLogs.length }));
              } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
              }
            });
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(syncState.auditLogs || []));
          return;
        }

        if (url === '/api/attendance') {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const payload = JSON.parse(body);
                const attToAdd = Array.isArray(payload) ? payload : [payload];
                if (!syncState.attendance) syncState.attendance = [];
                const existingMap = new Map(syncState.attendance.map(a => [`${a.userId}_${a.date}`, a]));
                for (const item of attToAdd) {
                  if (item && item.userId && item.date) {
                    const key = `${item.userId}_${item.date}`;
                    existingMap.set(key, item);
                  }
                }
                syncState.attendance = Array.from(existingMap.values());
                saveSyncState();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, count: syncState.attendance.length }));
              } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
              }
            });
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(syncState.attendance || []));
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
