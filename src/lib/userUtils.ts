import { User } from '../types';

/**
 * Generates a standardized, unique username from an employee's full name.
 * Rule: First letter of first name + first 4 letters of last name (e.g., Red Macha -> "rmach").
 * Collision handling: If duplicate (e.g. Maria Ignacio -> "migna" already taken),
 * automatically takes the 5th letter ("mignac"), 6th letter ("mignaci"), or appends a number if exhausted.
 */
export function generateUniqueUsername(
  fullName: string,
  existingUsers: User[] = [],
  currentUserId?: string
): string {
  const trimmed = (fullName || '').trim();
  if (!trimmed) {
    return 'agent';
  }

  // Remove accents/diacritics and convert to lowercase
  const normalized = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return 'agent';
  }

  // Set of existing usernames (excluding the current user being edited)
  const takenUsernames = new Set<string>();
  for (const u of existingUsers) {
    if (currentUserId && u.id === currentUserId) continue;
    if (u.username) {
      takenUsernames.add(u.username.trim().toLowerCase());
    }
  }

  // If single word name (e.g., "Admin", "Trainer")
  if (parts.length === 1) {
    const single = parts[0].replace(/[^a-z0-9]/g, '');
    let candidate = single.slice(0, 8);
    if (!candidate) candidate = 'agent';
    if (!takenUsernames.has(candidate)) {
      return candidate;
    }
    let suffix = 2;
    while (takenUsernames.has(`${candidate}${suffix}`)) {
      suffix++;
    }
    return `${candidate}${suffix}`;
  }

  const firstName = parts[0].replace(/[^a-z0-9]/g, '');
  const firstInitial = firstName.charAt(0) || 'u';

  // Surnames combined without spaces (handles "Dela Cruz", "De Los Santos", "Smith-Jones", etc.)
  const lastNameClean = parts.slice(1).join('').replace(/[^a-z0-9]/g, '');
  if (!lastNameClean) {
    let candidate = `${firstInitial}${firstName.slice(1, 5)}`;
    if (!takenUsernames.has(candidate)) return candidate;
    let suffix = 2;
    while (takenUsernames.has(`${candidate}${suffix}`)) suffix++;
    return `${candidate}${suffix}`;
  }

  // 1. Primary rule: 1st initial + first 4 letters of last name
  const primarySlice = lastNameClean.slice(0, 4);
  const primaryCandidate = `${firstInitial}${primarySlice}`;

  if (!takenUsernames.has(primaryCandidate)) {
    return primaryCandidate;
  }

  // 2. Collision resolution: Try adding 5th, 6th, etc. letters of the last name
  // e.g. migna -> mignac -> mignaci -> mignacio
  for (let len = 5; len <= lastNameClean.length; len++) {
    const extendedCandidate = `${firstInitial}${lastNameClean.slice(0, len)}`;
    if (!takenUsernames.has(extendedCandidate)) {
      return extendedCandidate;
    }
  }

  // 3. If last name length is fully exhausted (e.g. short last name like "Macha" or "Lee"), append numeric counter
  let counter = 2;
  while (takenUsernames.has(`${primaryCandidate}${counter}`)) {
    counter++;
  }
  return `${primaryCandidate}${counter}`;
}

/**
 * Validates a username string (lowercase alphanumeric, 3-20 chars).
 */
export function isValidUsername(username: string): boolean {
  if (!username) return false;
  return /^[a-z0-9_]{3,20}$/.test(username.trim().toLowerCase());
}
