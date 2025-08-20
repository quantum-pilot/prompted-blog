/**
 * Username validation for reserved and inappropriate usernames
 * Shared between client and server
 */

import { RESERVED } from './reserved';

/**
 * Check if a username matches a reserved word pattern
 * Reserved words are blocked as exact match or with 1-2 digits suffix
 * Examples: 'admin', 'admin1', 'admin12' are blocked, but 'admin123' is allowed
 */
function matchesReservedPattern(username: string): boolean {
  const lower = username.toLowerCase();
  
  for (const reserved of RESERVED) {
    // Exact match
    if (lower === reserved) {
      return true;
    }
    
    // Match with 1 or 2 digits suffix
    const pattern = new RegExp(`^${reserved}\\d{1,2}$`);
    if (pattern.test(lower)) {
      return true;
    }
  }
  
  return false;
}

// Common inappropriate terms (partial list for demonstration)
const INAPPROPRIATE_PATTERNS = [
  /^(fuck|shit|damn|hell|ass|bitch|crap|porn)/i,
];

/**
 * Check username validity - format, reserved words, and inappropriate terms
 * @param username - The username to validate
 * @returns undefined if valid, or a string with the reason if invalid
 */
export function checkUsernameValidity(username: string): string | undefined {
  if (!username) {
    return 'Username is required';
  }

  // Check length
  if (username.length < 3) {
    return 'Username must be at least 3 characters';
  }
  if (username.length > 30) {
    return 'Username must be at most 30 characters';
  }

  // Check format (lowercase alphanumeric with hyphens)
  // Cannot start/end with hyphen, no consecutive hyphens
  const formatPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  if (!formatPattern.test(username)) {
    return 'Username must be lowercase alphanumeric with hyphens (not at start/end, no consecutive)';
  }

  // Check reserved patterns (exact match or with 1-2 digits)
  if (matchesReservedPattern(username)) {
    return 'This username is reserved for system use';
  }

  // Check inappropriate patterns
  for (const pattern of INAPPROPRIATE_PATTERNS) {
    if (pattern.test(username)) {
      return 'This username contains inappropriate or restricted terms';
    }
  }

  // Username is valid
  return undefined;
}