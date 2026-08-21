/**
 * Philippine (Manila) Timezone & Duration Formatting Utilities
 * Default timezone: Asia/Manila (PHT / UTC+8)
 */

export const DEFAULT_TIMEZONE = 'Asia/Manila';

/**
 * Returns YYYY-MM-DD string for a given date in Asia/Manila timezone
 */
export function getManilaDateString(date: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().split('T')[0];
  }
}

/**
 * Returns formatted 12-hour time string (e.g. "11:40 AM") in Asia/Manila timezone
 */
export function getManilaTimeString(date: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
}

/**
 * Returns formatted 12-hour time with seconds (e.g. "11:40:51 AM") in Asia/Manila timezone
 */
export function getManilaTimeWithSeconds(date: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  }
}

/**
 * Returns full date display (e.g. "Friday, 21 Aug 2026") in Asia/Manila timezone
 */
export function getManilaFormattedDate(date: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return date.toDateString();
  }
}

/**
 * Converts seconds duration into an unambiguous human-friendly string:
 * - Under 60s: "45s"
 * - Under 1h: "12m 19s"
 * - 1h and above: "2h 15m" (or "1h 00m")
 *
 * This completely prevents users from mistaking a duration (e.g. 00:12:19) for a 24-hour clock time!
 */
export function formatDurationHuman(totalSec: number): string {
  if (!totalSec || totalSec <= 0) return '0m 00s';
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (hrs > 0) {
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h 00m`;
  }
  if (mins > 0) {
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  }
  return `${secs}s`;
}

/**
 * Converts seconds into "Xh Ym Zs" with full precision
 */
export function formatDurationDetailed(totalSec: number): string {
  if (!totalSec || totalSec <= 0) return '0m 00s';
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  return `${mins}m ${secs}s`;
}

/**
 * Standard HH:MM:SS format
 */
export function formatDurationHHMMSS(totalSec: number): string {
  if (!totalSec || totalSec <= 0) return '00:00:00';
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
