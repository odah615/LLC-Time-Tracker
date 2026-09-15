import { User } from '../types';

export const CANONICAL_EMPLOYEE_DIRECTORY: Record<string, { name: string; username: string; email: string; role: 'admin' | 'trainer' | 'agent'; designation: string }> = {
  'SUPERADMIN': { name: 'Admin', username: 'admin', email: 'admin@llc.com', role: 'admin', designation: 'Admin' },
  'LLC-0003': { name: 'Pia', username: 'trainer', email: 'piaodahcam@gmail.com', role: 'trainer', designation: 'Trainer' },
  'LLC-0004': { name: 'Alexa Gabrielle Bardaje', username: 'agabr', email: 'bardajealexagabrielle@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0005': { name: 'April Sam Dimaano', username: 'asamd', email: 'dimaanosam2@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0006': { name: 'Boris Andrew Villanueva', username: 'bandr', email: 'villanuevaboris@yahoo.com', role: 'agent', designation: 'Agent' },
  'LLC-0007': { name: 'Cyril Diola Garcia', username: 'cdiol', email: 'cyrilgarcia112814@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0008': { name: 'Daina Yanez', username: 'dyane', email: 'dama.yanez.coc@phinmaed.com', role: 'agent', designation: 'Agent' },
  'LLC-0009': { name: 'Fatima Dence David', username: 'fdenc', email: 'dencedavid20@icloud.com', role: 'agent', designation: 'Agent' },
  'LLC-0010': { name: 'Gerald A. Salvador', username: 'gasal', email: 'salvadorged898@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0011': { name: 'Jayson Cariaga', username: 'jcari', email: 'nabojayson154@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0012': { name: 'Jenalyn Nueva', username: 'jnuev', email: 'jenalyn.nueva9245@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0013': { name: 'Kathleen Ann L. Totaan', username: 'kannl', email: 'kathleen.totaan4@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0014': { name: 'Lourdes Mary Cenina', username: 'lmary', email: 'lourdescenina@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0015': { name: 'Luis David Ramirez', username: 'ldavi', email: 'ramirezluisdavid0312@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0016': { name: 'Maria Racquel Gracia M. Libarios', username: 'mracq', email: 'racquellibarios97@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0017': { name: 'Mark Jesus A. Egoy', username: 'mjesu', email: 'markjesusegoy@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0018': { name: 'Raquel Guiapal', username: 'rguia', email: 'kayefam25@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0019': { name: 'Ron Louie Logan', username: 'rloui', email: 'yeyesylogan5@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0020': { name: 'Rubilyne Barrameda', username: 'rbarr', email: 'brubilyne@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0021': { name: 'Shiela Romey', username: 'srome', email: 'mizfeb@hotmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0022': { name: 'Trixy Ashley Decena Mabutol', username: 'tashl', email: 'trixdecena@gmail.com', role: 'agent', designation: 'Agent' },
};

/**
 * Resolves a user's canonical Full Name and verified details by checking
 * employee code, username, ID, or email against the authoritative roster.
 */
export const resolveCanonicalEmployee = (input: {
  employeeCode?: string;
  name?: string;
  username?: string;
  email?: string;
  id?: string;
}): { code: string; name: string; username: string; email: string; role: 'admin' | 'trainer' | 'agent'; designation: string } | null => {
  if (!input) return null;
  const rawCode = (input.employeeCode || '').toUpperCase().trim();
  const numCode = rawCode.replace(/^[A-Z\-_]+/, '');
  const rawUser = (input.username || '').toLowerCase().trim();
  const rawName = (input.name || '').toLowerCase().trim();
  const rawEmail = (input.email || '').toLowerCase().trim();
  const rawId = (input.id || '').toLowerCase().trim();

  for (const [code, info] of Object.entries(CANONICAL_EMPLOYEE_DIRECTORY)) {
    const infoNum = code.replace(/^[A-Z\-_]+/, '');
    const codeMatch = rawCode === code || (numCode && numCode === infoNum) || (rawCode.includes(infoNum) && infoNum.length >= 2);
    const userMatch = rawUser === info.username || (rawUser.length >= 3 && rawUser === info.username);
    const nameMatch = rawName === info.name.toLowerCase() || rawName === info.username || rawName === code.toLowerCase();
    const emailMatch = rawEmail && rawEmail === info.email.toLowerCase();
    const idMatch = rawId.includes(code.toLowerCase()) || rawId.includes(info.username);

    if (codeMatch || userMatch || nameMatch || emailMatch || idMatch) {
      return { code, ...info };
    }
  }
  return null;
};

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

    // Auto-heal with canonical profile if available
    const canonical = resolveCanonicalEmployee(u);
    let effectiveUser: User = { ...u };
    if (canonical) {
      effectiveUser = {
        ...effectiveUser,
        name: canonical.name, // Guaranteed full employee name (e.g. Alexa Gabrielle Bardaje)
        username: canonical.username, // Guaranteed username (e.g. agabr)
        employeeCode: canonical.code, // Guaranteed code (e.g. LLC-0004)
        email: canonical.email || effectiveUser.email,
        role: canonical.role || effectiveUser.role,
        designation: canonical.designation || effectiveUser.designation || 'Agent',
      };
    }

    const normName = (effectiveUser.name || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    const normCode = (effectiveUser.employeeCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
    const numOnlyCode = normCode.replace(/^[A-Z]+/, '');
    const normEmail = (effectiveUser.email || '').toLowerCase().trim();
    const normUsername = (effectiveUser.username || '').toLowerCase().trim();
    const rawId = (effectiveUser.id || '').trim();

    // Check if matching user already exists in result
    let existingIndex = -1;
    if (normCode && codeMap.has(normCode)) {
      existingIndex = codeMap.get(normCode)!;
    } else if (numOnlyCode && numCodeMap.has(numOnlyCode)) {
      existingIndex = numCodeMap.get(numOnlyCode)!;
    } else if (normUsername && userMap.has(normUsername)) {
      existingIndex = userMap.get(normUsername)!;
    } else if (normEmail && emailMap.has(normEmail)) {
      existingIndex = emailMap.get(normEmail)!;
    } else if (normName && nameMap.has(normName)) {
      existingIndex = nameMap.get(normName)!;
    } else if (rawId && idMap.has(rawId)) {
      existingIndex = idMap.get(rawId)!;
    }

    if (existingIndex >= 0) {
      const existing = result[existingIndex];
      const existingCanon = resolveCanonicalEmployee(existing);
      const chosenName = canonical?.name || existingCanon?.name || (effectiveUser.name && effectiveUser.name !== effectiveUser.username ? effectiveUser.name : existing.name);
      const chosenUsername = canonical?.username || existingCanon?.username || effectiveUser.username || existing.username;
      const chosenCode = canonical?.code || existingCanon?.code || effectiveUser.employeeCode || existing.employeeCode;

      // Merge records cleanly into one authoritative user
      const merged: User = {
        ...existing,
        ...effectiveUser,
        name: chosenName,
        employeeCode: chosenCode,
        username: chosenUsername,
        email: canonical?.email || existing.email || effectiveUser.email,
        role: existing.role && existing.role !== 'agent' ? existing.role : (effectiveUser.role || 'agent'),
        designation: existing.designation || effectiveUser.designation || 'Agent',
        department: existing.department || effectiveUser.department || 'Operations',
        teamLeaderId: existing.teamLeaderId || effectiveUser.teamLeaderId || 'usr-llc-0003',
        password:
          existing.password && existing.password !== 'Password123!'
            ? existing.password
            : effectiveUser.password || existing.password || 'Password123!',
        customPermissions: existing.customPermissions || effectiveUser.customPermissions,
        avatar: existing.avatar || effectiveUser.avatar,
      };
      result[existingIndex] = merged;
    } else {
      const newIndex = result.length;
      result.push(effectiveUser);
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
