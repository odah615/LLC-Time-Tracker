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
 * Checks if an employee name or username is a placeholder/dummy name
 * such as Agent_1, Agent 2, Agent_Admin, Team_Leader1, Trainee 1, etc.
 */
export const isPlaceholderName = (name?: string, username?: string, employeeCode?: string): boolean => {
  if (!name && !username) return true;
  const cleanName = (name || '').trim();
  const cleanUser = (username || '').trim();
  const cleanCode = (employeeCode || '').trim().toUpperCase();

  // Explicit legacy dummy accounts
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

/**
 * Universally deduplicates and purges redundant/dummy users by:
 * 1. Normalizing SuperAdmin to usr-superadmin-red
 * 2. Normalizing Trainer (Pia / LLC-0003) to usr-llc-0003
 * 3. Matching trainees & staff by Full Name, Employee Code, Email, or ID
 * 4. Discarding placeholder junk accounts (Agent 1, Agent 2, Agent_Admin, Team_Leader1)
 * 5. Merging duplicate records into a single authoritative record.
 */
export const deduplicateUsers = (rawUsers: User[]): User[] => {
  if (!Array.isArray(rawUsers) || rawUsers.length === 0) return [];

  const nameMap = new Map<string, number>();
  const codeMap = new Map<string, number>();
  const numCodeMap = new Map<string, number>();
  const emailMap = new Map<string, number>();
  const userMap = new Map<string, number>();
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
        password: u.password || 'AdminpassW0rd123!',
      };
      if (existingAdminIdx >= 0) {
        result[existingAdminIdx] = { ...result[existingAdminIdx], ...canonicalAdmin };
      } else {
        result.unshift(canonicalAdmin);
      }
      continue;
    }

    // Check if Trainer (Pia / LLC-0003)
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
      const canonicalTrainer: User = {
        ...u,
        id: 'usr-llc-0003',
        employeeCode: 'LLC-0003',
        email: 'piaodahcam@gmail.com',
        name: 'Pia',
        role: 'trainer',
        designation: 'Trainer',
        username: 'trainer',
        department: 'Training',
        geoTimezone: u.geoTimezone || 'Asia/Manila',
        geoCity: u.geoCity || 'Manila, Philippines',
      };
      if (existingTrainerIdx >= 0) {
        result[existingTrainerIdx] = { ...result[existingTrainerIdx], ...canonicalTrainer };
      } else {
        result.push(canonicalTrainer);
      }
      continue;
    }

    // Filter out dummy test placeholders (Agent_Admin, Team_Leader1, Agent 1, Agent 2, Trainee 1, etc.)
    if (isPlaceholderName(u.name, u.username, u.employeeCode)) {
      continue;
    }

    const normName = (u.name || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    const normCode = (u.employeeCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
    const numOnlyCode = normCode.replace(/^[A-Z]+/, '');
    const normEmail = (u.email || '').toLowerCase().trim();
    const normUsername = (u.username || '').toLowerCase().trim();
    const rawId = (u.id || '').trim();

    // Check if matching user already exists in result
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
      // Merge records cleanly into one authoritative user
      const merged: User = {
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
        password:
          existing.password && existing.password !== 'Password123!'
            ? existing.password
            : u.password || existing.password || 'Password123!',
        customPermissions: existing.customPermissions || u.customPermissions,
        avatar: existing.avatar || u.avatar,
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
};
