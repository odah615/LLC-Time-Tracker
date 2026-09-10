import { User } from '../types';

/**
 * Generates a clean, unique username from an employee name.
 * e.g. "Alexa Gabrielle Bardaje" -> "abardaje"
 */
export const generateUniqueUsername = (
  name: string,
  existingUsers: User[] = [],
  excludeUserId?: string
): string => {
  if (!name || !name.trim()) return `user${Math.floor(1000 + Math.random() * 9000)}`;

  const clean = name.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const parts = clean.split(/\s+/).filter(Boolean);

  let base = '';
  if (parts.length === 1) {
    base = parts[0];
  } else if (parts.length >= 2) {
    base = `${parts[0][0]}${parts[parts.length - 1]}`;
  } else {
    base = 'user';
  }

  const takenUsernames = new Set(
    existingUsers
      .filter((u) => !excludeUserId || u.id !== excludeUserId)
      .map((u) => (u.username || '').toLowerCase().trim())
      .filter(Boolean)
  );

  let candidate = base;
  let counter = 1;
  while (takenUsernames.has(candidate)) {
    candidate = `${base}${counter}`;
    counter++;
  }

  return candidate;
};

/**
 * Checks if an employee name is a placeholder/generic name

 * such as Agent_1, Agent 2, Trainer1, etc.
 */
export const isPlaceholderName = (name?: string): boolean => {
  if (!name) return true;
  const clean = name.trim();
  return /^Agent[_\s]?\d+$/i.test(clean) || /^Trainer\d*$/i.test(clean);
};

/**
 * Universally deduplicates a list of users by:
 * 1. Normalizing SuperAdmin to usr-superadmin-red
 * 2. Normalizing employeeCode (e.g. 'LLC-0001')
 * 3. Normalizing email (e.g. 'agentadmin@llc.com')
 * 4. Resolving conflicts by preferring real named users over placeholder names
 *    and preserving custom credentials/settings.
 */
export const deduplicateUsers = (rawUsers: User[]): User[] => {
  if (!Array.isArray(rawUsers) || rawUsers.length === 0) return [];

  const codeMap = new Map<string, number>();
  const emailMap = new Map<string, number>();
  const idMap = new Map<string, number>();
  const result: User[] = [];

  for (const u of rawUsers) {
    if (!u) continue;

    // Check if SuperAdmin
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
      const canonicalAdmin: User = {
        ...u,
        id: 'usr-superadmin-red',
        employeeCode: 'SuperAdmin',
        email: 'admin@llc.com',
        name: u.name === 'Red' ? 'Red' : 'Admin',
        role: 'admin',
        designation: 'Admin',
        username: u.username || 'admin',
        geoTimezone: u.geoTimezone || 'Asia/Manila',
        geoCity: u.geoCity || 'Manila, Philippines',
      };
      if (existingAdminIdx >= 0) {
        result[existingAdminIdx] = { ...result[existingAdminIdx], ...canonicalAdmin };
      } else {
        result.unshift(canonicalAdmin);
      }
      continue;
    }

    const normCode = (u.employeeCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const normEmail = (u.email || '').toLowerCase().trim();
    const rawId = (u.id || '').trim();

    // Check if matching user already exists
    let existingIndex = -1;
    if (normCode && codeMap.has(normCode)) {
      existingIndex = codeMap.get(normCode)!;
    } else if (normEmail && emailMap.has(normEmail)) {
      existingIndex = emailMap.get(normEmail)!;
    } else if (rawId && idMap.has(rawId)) {
      existingIndex = idMap.get(rawId)!;
    }

    if (existingIndex >= 0) {
      const existing = result[existingIndex];
      const existingIsPlaceholder = isPlaceholderName(existing.name);
      const uIsPlaceholder = isPlaceholderName(u.name);

      let merged: User;
      if (existingIsPlaceholder && !uIsPlaceholder) {
        // New user has a real name, replace the placeholder entry
        merged = {
          ...existing,
          ...u,
          // Preserve valid custom password
          password:
            existing.password && existing.password !== 'Password123!'
              ? existing.password
              : u.password || existing.password,
          customPermissions: existing.customPermissions || u.customPermissions,
        };
      } else {
        // Existing user is already real, merge non-empty fields
        merged = {
          ...u,
          ...existing,
          name: !existingIsPlaceholder ? existing.name : u.name || existing.name,
          password:
            existing.password && existing.password !== 'Password123!'
              ? existing.password
              : u.password || existing.password,
          customPermissions: existing.customPermissions || u.customPermissions,
        };
      }
      result[existingIndex] = merged;
    } else {
      const newIndex = result.length;
      result.push(u);
      if (normCode) codeMap.set(normCode, newIndex);
      if (normEmail) emailMap.set(normEmail, newIndex);
      if (rawId) idMap.set(rawId, newIndex);
    }
  }

  return result;
};
