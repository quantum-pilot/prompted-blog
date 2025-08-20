// @agent: cloudflare-backend
/**
 * Username blocklist for reserved and inappropriate usernames
 */

// Reserved system usernames
const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'root', 'system', 'api', 'app',
  'auth', 'login', 'logout', 'register', 'signup', 'signin',
  'oauth', 'callback', 'webhook', 'test', 'demo', 'support',
  'help', 'contact', 'about', 'privacy', 'terms', 'legal',
  'security', 'abuse', 'info', 'noreply', 'no-reply', 'postmaster',
  'webmaster', 'mail', 'email', 'www', 'ftp', 'ssh', 'sftp',
  'public', 'private', 'user', 'users', 'account', 'accounts',
  'profile', 'profiles', 'settings', 'config', 'configuration',
  'dashboard', 'home', 'index', 'default', 'undefined', 'null',
  'anonymous', 'guest', 'bot', 'robot', 'crawler', 'spider'
]);

// Common inappropriate terms (partial list for demonstration)
const INAPPROPRIATE_PATTERNS = [
  /^(fuck|shit|damn|hell|ass|bitch|crap)/i,
  /^(admin|moderator|staff|official)$/i,  // Only exact matches
  /^(test\d{1,3}|user\d{1,3}|temp\d{0,3})$/i  // Only exact patterns like test1, user1, temp
];

export class UsernameBlocklist {
  /**
   * Check if a username is blocked (reserved or inappropriate)
   */
  static isBlocked(username: string): boolean {
    if (!username) return true;
    
    const lower = username.toLowerCase();
    
    // Check reserved usernames
    if (RESERVED_USERNAMES.has(lower)) {
      return true;
    }
    
    // Check inappropriate patterns
    for (const pattern of INAPPROPRIATE_PATTERNS) {
      if (pattern.test(username)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Get a user-friendly error message for why a username is blocked
   */
  static getBlockReason(username: string): string {
    const lower = username.toLowerCase();
    
    if (RESERVED_USERNAMES.has(lower)) {
      return 'This username is reserved for system use';
    }
    
    for (const pattern of INAPPROPRIATE_PATTERNS) {
      if (pattern.test(username)) {
        return 'This username contains inappropriate or restricted terms';
      }
    }
    
    return 'This username is not allowed';
  }
}