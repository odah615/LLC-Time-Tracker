import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS headers for desktop apps and cross-origin requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Central File Persistence Bridge
const SYNC_BRIDGE_FILE = path.join(process.cwd(), '.sync_bridge.json');

interface BridgeData {
  presence: Record<string, any>;
  timelogs: any[];
  users: any[];
  attendance: any[];
  auditlogs: any[];
  config: { webhookUrl?: string; spreadsheetId?: string };
}

let bridgeState: BridgeData = {
  presence: {},
  timelogs: [],
  users: [],
  attendance: [],
  auditlogs: [],
  config: {
    webhookUrl: 'https://script.google.com/macros/s/AKfycbyKGMOWV0u5xcv_lOKBk6LXpbjrlgZiuqtCs3_HbqjekoJZdXpdfA_1kDjP7H0ulLsw3Q/exec',
    spreadsheetId: '1h8ssmDEcV-PMGlkpOzfQCtlRpnoT0CBQQveT3e4wPfA',
  },
};

const CANONICAL_STAFF: Record<string, string> = {
  'SUPERADMIN': 'Admin',
  'LLC-0003': 'Pia',
  'LLC-0004': 'Alexa Gabrielle Bardaje',
  'LLC-0005': 'April Sam Dimaano',
  'LLC-0006': 'Boris Andrew Villanueva',
  'LLC-0007': 'Cyril Diola Garcia',
  'LLC-0008': 'Daina Yanez',
  'LLC-0009': 'Fatima Dence David',
  'LLC-0010': 'Gerald A. Salvador',
  'LLC-0011': 'Jayson Cariaga',
  'LLC-0012': 'Jenalyn Nueva',
  'LLC-0013': 'Kathleen Ann L. Totaan',
  'LLC-0014': 'Lourdes Mary Cenina',
  'LLC-0015': 'Luis David Ramirez',
  'LLC-0016': 'Maria Racquel Gracia M. Libarios',
  'LLC-0017': 'Mark Jesus A. Egoy',
  'LLC-0018': 'Raquel Guiapal',
  'LLC-0019': 'Ron Louie Logan',
  'LLC-0020': 'Rubilyne Barrameda',
  'LLC-0021': 'Shiela Romey',
  'LLC-0022': 'Trixy Ashley Decena Mabutol',
  'LLC-0023': 'Juan David',
  'LLC-0046': 'Y. Obiedo',
  'LLC-0047': 'R. Vegilla',
};

const resolveStaffName = (code?: string, username?: string, name?: string, id?: string): string => {
  const n = (name || '').trim();
  if (n && n !== 'Unknown' && n !== 'Employee' && n !== 'Staff' && n !== 'Agent') {
    return n;
  }
  const c = (code || '').toUpperCase().trim();
  const num = c.replace(/^[A-Z\-_]+/, '');
  for (const [k, v] of Object.entries(CANONICAL_STAFF)) {
    const kNum = k.replace(/^[A-Z\-_]+/, '');
    if (c === k || (num && kNum && num === kNum)) return v;
  }
  const u = (username || '').toLowerCase().trim();
  const nLower = n.toLowerCase();
  const rawId = (id || '').toLowerCase().trim();
  if (u === 'jdavid' || nLower === 'jdavid' || rawId.includes('0023')) return 'Juan David';
  if (u === 'yobiedo' || nLower === 'yobiedo' || rawId.includes('0046')) return 'Y. Obiedo';
  if (u === 'rvegilla' || nLower === 'rvegilla' || rawId.includes('0047')) return 'R. Vegilla';
  if (u === 'agabr' || nLower === 'agabr' || rawId.includes('0004')) return 'Alexa Gabrielle Bardaje';
  if (u === 'asamd' || nLower === 'asamd' || rawId.includes('0005')) return 'April Sam Dimaano';
  if (u === 'bandr' || nLower === 'bandr' || rawId.includes('0006')) return 'Boris Andrew Villanueva';
  if (u === 'cdiol' || nLower === 'cdiol' || rawId.includes('0007')) return 'Cyril Diola Garcia';
  if (u === 'dyane' || nLower === 'dyane' || rawId.includes('0008')) return 'Daina Yanez';
  if (u === 'fdenc' || nLower === 'fdenc' || rawId.includes('0009')) return 'Fatima Dence David';
  if (u === 'gasal' || nLower === 'gasal' || rawId.includes('0010')) return 'Gerald A. Salvador';
  if (u === 'jcari' || nLower === 'jcari' || rawId.includes('0011')) return 'Jayson Cariaga';
  if (u === 'jnuev' || nLower === 'jnuev' || rawId.includes('0012')) return 'Jenalyn Nueva';
  if (u === 'kannl' || nLower === 'kannl' || rawId.includes('0013')) return 'Kathleen Ann L. Totaan';
  if (u === 'lmary' || nLower === 'lmary' || rawId.includes('0014')) return 'Lourdes Mary Cenina';
  if (u === 'ldavi' || nLower === 'ldavi' || rawId.includes('0015')) return 'Luis David Ramirez';
  if (u === 'mracq' || nLower === 'mracq' || rawId.includes('0016')) return 'Maria Racquel Gracia M. Libarios';
  if (u === 'mjesu' || nLower === 'mjesu' || rawId.includes('0017')) return 'Mark Jesus A. Egoy';
  if (u === 'rguia' || nLower === 'rguia' || rawId.includes('0018')) return 'Raquel Guiapal';
  if (u === 'rloui' || nLower === 'rloui' || rawId.includes('0019')) return 'Ron Louie Logan';
  if (u === 'rbarr' || nLower === 'rbarr' || rawId.includes('0020')) return 'Rubilyne Barrameda';
  if (u === 'srome' || nLower === 'srome' || rawId.includes('0021')) return 'Shiela Romey';
  if (u === 'tashl' || nLower === 'tashl' || rawId.includes('0022')) return 'Trixy Ashley Decena Mabutol';
  if (u === 'trainer' || nLower === 'pia' || c === 'LLC-0003') return 'Pia';
  if (u === 'admin' || c === 'SUPERADMIN') return 'Admin';
  return n || username || 'Employee';
};

// Load initial bridge state if exists
try {
  if (fs.existsSync(SYNC_BRIDGE_FILE)) {
    const raw = fs.readFileSync(SYNC_BRIDGE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const sanitizedUsers = Array.isArray(parsed.users)
        ? parsed.users.map((u: any) => ({
            ...u,
            name: resolveStaffName(u.employeeCode, u.username, u.name, u.id),
          }))
        : [];
      const sanitizedPresence: Record<string, any> = {};
      if (parsed.presence && typeof parsed.presence === 'object') {
        for (const [k, v] of Object.entries(parsed.presence)) {
          if (v && typeof v === 'object') {
            const p = v as any;
            sanitizedPresence[k] = {
              ...p,
              userName: resolveStaffName(p.employeeCode, p.userName, p.userName, p.userId),
            };
          }
        }
      }

      bridgeState = {
        presence: sanitizedPresence,
        timelogs: Array.isArray(parsed.timelogs) ? parsed.timelogs : [],
        users: sanitizedUsers,
        attendance: Array.isArray(parsed.attendance) ? parsed.attendance : [],
        auditlogs: Array.isArray(parsed.auditlogs) ? parsed.auditlogs : [],
        config: parsed.config || { webhookUrl: '', spreadsheetId: '1h8ssmDEcV-PMGlkpOzfQCtlRpnoT0CBQQveT3e4wPfA' },
      };
    }
  }
} catch (e) {
  console.warn('[Bridge] Error loading bridge file:', e);
}

let saveDebounceTimer: any = null;
const persistBridgeState = () => {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    try {
      fs.writeFileSync(SYNC_BRIDGE_FILE, JSON.stringify(bridgeState, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[Bridge] Error saving bridge file:', e);
    }
  }, 1000);
};

// Cleanup stale presence sessions (offline after 3 minutes without heartbeat)
const cleanStalePresence = () => {
  const now = Date.now();
  let changed = false;
  for (const [userId, p] of Object.entries(bridgeState.presence)) {
    if (p && p.isOnline) {
      const lastHbMs = p.lastHeartbeat ? new Date(p.lastHeartbeat).getTime() : 0;
      const timeoutMs = p.isTracking ? 180000 : 90000; // 3 mins if tracking, 90s if just idle/web
      if (lastHbMs > 0 && now - lastHbMs > timeoutMs) {
        bridgeState.presence[userId] = {
          ...p,
          isOnline: false,
          status: 'offline',
          isTracking: false,
          isPaused: false,
          currentTask: 'Shift Concluded',
          currentApp: 'None',
        };
        changed = true;
      }
    }
  }
  if (changed) persistBridgeState();
};

setInterval(cleanStalePresence, 10000);

// ==========================================
// API ROUTES
// ==========================================

// Health Check
app.get('/api/health', (req, res) => {
  cleanStalePresence();
  const onlineCount = Object.values(bridgeState.presence).filter((p: any) => p?.isOnline).length;
  const trackingCount = Object.values(bridgeState.presence).filter((p: any) => p?.isOnline && p?.isTracking).length;
  res.json({
    status: 'ok',
    serverTime: new Date().toISOString(),
    onlineUsers: onlineCount,
    trackingUsers: trackingCount,
    totalRegisteredUsers: bridgeState.users.length,
    timelogsCount: bridgeState.timelogs.length,
  });
});

// Config Endpoints
app.get('/api/config', (req, res) => {
  res.json(bridgeState.config);
});

app.post('/api/config', (req, res) => {
  if (req.body && typeof req.body === 'object') {
    bridgeState.config = {
      ...bridgeState.config,
      ...req.body,
    };
    persistBridgeState();
  }
  res.json({ success: true, config: bridgeState.config });
});

// Presence Endpoints
app.get('/api/presence', (req, res) => {
  cleanStalePresence();
  res.json(Object.values(bridgeState.presence));
});

app.post('/api/presence', (req, res) => {
  const p = req.body;
  if (!p || !p.userId) {
    return res.status(400).json({ error: 'Missing userId in presence payload' });
  }

  const existing = bridgeState.presence[p.userId] || {};
  const sanitizedName = resolveStaffName(p.employeeCode || existing.employeeCode, p.userName || existing.userName, p.userName || existing.userName, p.userId);
  bridgeState.presence[p.userId] = {
    ...existing,
    ...p,
    userName: sanitizedName,
    lastHeartbeat: p.lastHeartbeat || new Date().toISOString(),
  };

  persistBridgeState();
  res.json({ success: true, presence: bridgeState.presence[p.userId] });
});

app.post('/api/presence/batch', (req, res) => {
  const list = req.body;
  if (Array.isArray(list)) {
    for (const p of list) {
      if (p && p.userId) {
        const existing = bridgeState.presence[p.userId] || {};
        const sanitizedName = resolveStaffName(p.employeeCode || existing.employeeCode, p.userName || existing.userName, p.userName || existing.userName, p.userId);
        bridgeState.presence[p.userId] = {
          ...existing,
          ...p,
          userName: sanitizedName,
          lastHeartbeat: p.lastHeartbeat || new Date().toISOString(),
        };
      }
    }
    persistBridgeState();
  }
  res.json({ success: true, count: Object.keys(bridgeState.presence).length });
});

// TimeLogs Endpoints
app.get('/api/timelogs', (req, res) => {
  res.json(bridgeState.timelogs);
});

app.post('/api/timelogs', (req, res) => {
  const incoming = req.body;
  if (Array.isArray(incoming)) {
    const map = new Map<string, any>(bridgeState.timelogs.map((l) => [l.id, l]));
    for (const log of incoming) {
      if (log && log.id) {
        map.set(log.id, { ...(map.get(log.id) || {}), ...log });
      }
    }
    bridgeState.timelogs = Array.from(map.values());
    persistBridgeState();
    return res.json({ success: true, count: bridgeState.timelogs.length });
  } else if (incoming && incoming.id) {
    const map = new Map<string, any>(bridgeState.timelogs.map((l) => [l.id, l]));
    const existing = map.get(incoming.id) || {};
    const mergedLog = { ...existing, ...incoming };
    if (Number(existing.durationSeconds || 0) > Number(incoming.durationSeconds || 0)) {
      mergedLog.durationSeconds = existing.durationSeconds;
    }
    if (existing.status === 'completed' && incoming.status !== 'completed') {
      mergedLog.status = existing.status;
      mergedLog.endTime = existing.endTime || mergedLog.endTime;
      mergedLog.geoLocalEndTime = existing.geoLocalEndTime || mergedLog.geoLocalEndTime;
    }
    map.set(incoming.id, mergedLog);
    bridgeState.timelogs = Array.from(map.values());
    persistBridgeState();
    return res.json({ success: true, log: incoming });
  }
  res.status(400).json({ error: 'Invalid timelog payload' });
});

// Users Endpoints
app.get('/api/users', (req, res) => {
  res.json(bridgeState.users);
});

app.post('/api/users', (req, res) => {
  const incoming = req.body;
  if (Array.isArray(incoming)) {
    const map = new Map<string, any>(bridgeState.users.map((u) => [u.id, u]));
    for (const u of incoming) {
      if (u && u.id) {
        const sanitized = {
          ...u,
          name: resolveStaffName(u.employeeCode, u.username, u.name, u.id),
        };
        const existing = map.get(u.id) || {};
        const incomingPassword = String(sanitized.password || '').trim();
        const existingPassword = String(existing.password || '').trim();
        const mergedUser = { ...existing, ...sanitized };
        const incomingPasswordIsUnsafe =
          !incomingPassword ||
          incomingPassword === 'Password123!' ||
          incomingPassword.includes('*');

        if (existingPassword && existingPassword !== 'Password123!' && incomingPasswordIsUnsafe) {
          mergedUser.password = existing.password;
          if (existing.mustChangePassword !== undefined) {
            mergedUser.mustChangePassword = existing.mustChangePassword;
          }
        }

        map.set(u.id, mergedUser);
      }
    }
    bridgeState.users = Array.from(map.values());
    persistBridgeState();
    return res.json({ success: true, count: bridgeState.users.length });
  } else if (incoming && incoming.id) {
    const map = new Map<string, any>(bridgeState.users.map((u) => [u.id, u]));
    const sanitized = {
      ...incoming,
      name: resolveStaffName(incoming.employeeCode, incoming.username, incoming.name, incoming.id),
    };
    const existing = map.get(incoming.id) || {};
    const incomingPassword = String(sanitized.password || '').trim();
    const existingPassword = String(existing.password || '').trim();
    const mergedUser = { ...existing, ...sanitized };
    const incomingPasswordIsUnsafe =
      !incomingPassword ||
      incomingPassword === 'Password123!' ||
      incomingPassword.includes('*');

    if (existingPassword && existingPassword !== 'Password123!' && incomingPasswordIsUnsafe) {
      mergedUser.password = existing.password;
      if (existing.mustChangePassword !== undefined) {
        mergedUser.mustChangePassword = existing.mustChangePassword;
      }
    }

    map.set(incoming.id, mergedUser);
    bridgeState.users = Array.from(map.values());
    persistBridgeState();
    return res.json({ success: true, user: sanitized });
  }
  res.status(400).json({ error: 'Invalid user payload' });
});

// Attendance Endpoints
app.get('/api/attendance', (req, res) => {
  res.json(bridgeState.attendance);
});

app.post('/api/attendance', (req, res) => {
  const incoming = req.body;
  if (Array.isArray(incoming)) {
    const map = new Map<string, any>(bridgeState.attendance.map((a) => [a.id || `${a.userId}_${a.date}`, a]));
    for (const a of incoming) {
      const k = a.id || `${a.userId}_${a.date}`;
      if (k) {
        map.set(k, { ...(map.get(k) || {}), ...a });
      }
    }
    bridgeState.attendance = Array.from(map.values());
    persistBridgeState();
    return res.json({ success: true, count: bridgeState.attendance.length });
  } else if (incoming) {
    const k = incoming.id || `${incoming.userId}_${incoming.date}`;
    const map = new Map<string, any>(bridgeState.attendance.map((a) => [a.id || `${a.userId}_${a.date}`, a]));
    map.set(k, { ...(map.get(k) || {}), ...incoming });
    bridgeState.attendance = Array.from(map.values());
    persistBridgeState();
    return res.json({ success: true, attendance: incoming });
  }
  res.status(400).json({ error: 'Invalid attendance payload' });
});

// AuditLogs Endpoints
app.get('/api/auditlogs', (req, res) => {
  res.json(bridgeState.auditlogs);
});

app.post('/api/auditlogs', (req, res) => {
  const incoming = req.body;
  if (incoming && incoming.id) {
    const exists = bridgeState.auditlogs.some((l) => l.id === incoming.id);
    if (!exists) {
      bridgeState.auditlogs = [incoming, ...bridgeState.auditlogs].slice(0, 1000);
      persistBridgeState();
    }
    return res.json({ success: true, log: incoming });
  }
  res.status(400).json({ error: 'Invalid auditlog payload' });
});

// Google Sheets Sync Proxy (bypasses CORS restrictions)
app.post('/api/sync-sheets', async (req, res) => {
  try {
    const webhookUrl = req.body?.webhookUrl || bridgeState.config.webhookUrl;
    if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('https://')) {
      return res.status(400).json({ success: false, error: 'Invalid or missing Google Apps Script webhook URL' });
    }

    if (webhookUrl && webhookUrl !== bridgeState.config.webhookUrl) {
      bridgeState.config.webhookUrl = webhookUrl;
      persistBridgeState();
    }

    const payload = req.body?.payload || req.body;
    const fetchResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    const text = await fetchResponse.text();
    let jsonResult;
    try {
      jsonResult = JSON.parse(text);
    } catch {
      jsonResult = { response: text };
    }

    if (jsonResult && jsonResult.status === 'ERROR') {
      return res.status(200).json({ success: false, error: jsonResult.message || 'Google Apps Script execution error', result: jsonResult });
    }

    res.json({ success: true, result: jsonResult });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

app.get('/api/sync-sheets', async (req, res) => {
  try {
    const webhookUrl = (req.query?.url as string) || bridgeState.config.webhookUrl;
    if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('https://')) {
      return res.status(400).json({ success: false, error: 'Invalid or missing Google Apps Script webhook URL' });
    }

    const fetchResponse = await fetch(webhookUrl, {
      method: 'GET',
      redirect: 'follow',
    });

    const text = await fetchResponse.text();
    let jsonResult;
    try {
      jsonResult = JSON.parse(text);
    } catch {
      jsonResult = { response: text };
    }

    res.json(jsonResult);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// ==========================================
// VITE / STATIC MIDDLEWARE
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: ['**/.sync_bridge.json'],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LLC Time Tracker Central Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
