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
    webhookUrl: '',
    spreadsheetId: '1h8ssmDEcV-PMGlkpOzfQCtlRpnoT0CBQQveT3e4wPfA',
  },
};

// Load initial bridge state if exists
try {
  if (fs.existsSync(SYNC_BRIDGE_FILE)) {
    const raw = fs.readFileSync(SYNC_BRIDGE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      bridgeState = {
        presence: parsed.presence || {},
        timelogs: Array.isArray(parsed.timelogs) ? parsed.timelogs : [],
        users: Array.isArray(parsed.users) ? parsed.users : [],
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
  bridgeState.presence[p.userId] = {
    ...existing,
    ...p,
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
        bridgeState.presence[p.userId] = {
          ...existing,
          ...p,
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
    map.set(incoming.id, { ...(map.get(incoming.id) || {}), ...incoming });
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
        map.set(u.id, { ...(map.get(u.id) || {}), ...u });
      }
    }
    bridgeState.users = Array.from(map.values());
    persistBridgeState();
    return res.json({ success: true, count: bridgeState.users.length });
  } else if (incoming && incoming.id) {
    const map = new Map<string, any>(bridgeState.users.map((u) => [u.id, u]));
    map.set(incoming.id, { ...(map.get(incoming.id) || {}), ...incoming });
    bridgeState.users = Array.from(map.values());
    persistBridgeState();
    return res.json({ success: true, user: incoming });
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
      return res.status(400).json({ error: 'Invalid or missing Google Apps Script webhook URL' });
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
    });

    const text = await fetchResponse.text();
    let jsonResult;
    try {
      jsonResult = JSON.parse(text);
    } catch {
      jsonResult = { response: text };
    }

    res.json({ success: true, result: jsonResult });
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
      server: { middlewareMode: true },
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
