import { describe, it, expect } from 'vitest';
import { checkUsernameValidity } from '../username-blocklist';

describe('checkUsernameValidity', () => {
  describe('reserved pattern matching', () => {
    it('should block exact reserved words', () => {
      expect(checkUsernameValidity('admin')).toBeTruthy();
      expect(checkUsernameValidity('api')).toBeTruthy();
      expect(checkUsernameValidity('www')).toBeTruthy();
      expect(checkUsernameValidity('blog')).toBeTruthy();
    });

    it('should block reserved words with 1 digit suffix', () => {
      expect(checkUsernameValidity('admin1')).toBeTruthy();
      expect(checkUsernameValidity('api9')).toBeTruthy();
      expect(checkUsernameValidity('www0')).toBeTruthy();
      expect(checkUsernameValidity('blog5')).toBeTruthy();
    });

    it('should block reserved words with 2 digit suffix', () => {
      expect(checkUsernameValidity('admin12')).toBeTruthy();
      expect(checkUsernameValidity('api99')).toBeTruthy();
      expect(checkUsernameValidity('www11')).toBeTruthy();
      expect(checkUsernameValidity('blog00')).toBeTruthy();
    });

    it('should allow reserved words with 3+ digit suffix', () => {
      expect(checkUsernameValidity('admin123')).toBeUndefined();
      expect(checkUsernameValidity('api999')).toBeUndefined();
      expect(checkUsernameValidity('www111')).toBeUndefined();
      expect(checkUsernameValidity('blog000')).toBeUndefined();
    });

    it('should allow usernames that contain but dont match reserved patterns', () => {
      expect(checkUsernameValidity('myadmin')).toBeUndefined();
      expect(checkUsernameValidity('adminpanel')).toBeUndefined();
      expect(checkUsernameValidity('myapi')).toBeUndefined();
      expect(checkUsernameValidity('blogging')).toBeUndefined();
    });

    it('should be case insensitive for reserved words', () => {
      expect(checkUsernameValidity('ADMIN')).toBeTruthy();
      expect(checkUsernameValidity('Admin1')).toBeTruthy();
      expect(checkUsernameValidity('API12')).toBeTruthy();
      expect(checkUsernameValidity('WwW')).toBeTruthy();
    });

    it('should check special reserved words correctly', () => {
      // Check some specific words from the list
      expect(checkUsernameValidity('ww')).toBeTruthy();
      expect(checkUsernameValidity('wws')).toBeTruthy();
      expect(checkUsernameValidity('wwws')).toBeTruthy();
      expect(checkUsernameValidity('wwww')).toBeTruthy();
      
      // With suffix patterns
      expect(checkUsernameValidity('ww1')).toBeTruthy();
      expect(checkUsernameValidity('wws12')).toBeTruthy();
      expect(checkUsernameValidity('ww123')).toBeUndefined(); // 3 digits ok
    });
  });

  describe('format validation', () => {
    it('should reject usernames that are too short', () => {
      expect(checkUsernameValidity('ab')).toContain('at least 3 characters');
      expect(checkUsernameValidity('a')).toContain('at least 3 characters');
      expect(checkUsernameValidity('')).toContain('required');
    });

    it('should reject usernames that are too long', () => {
      const longUsername = 'a'.repeat(31);
      expect(checkUsernameValidity(longUsername)).toContain('at most 30 characters');
    });

    it('should reject usernames with invalid characters', () => {
      expect(checkUsernameValidity('user_name')).toContain('lowercase alphanumeric');
      expect(checkUsernameValidity('user.name')).toContain('lowercase alphanumeric');
      expect(checkUsernameValidity('user@name')).toContain('lowercase alphanumeric');
      expect(checkUsernameValidity('user name')).toContain('lowercase alphanumeric');
    });

    it('should reject usernames starting or ending with hyphen', () => {
      expect(checkUsernameValidity('-username')).toContain('lowercase alphanumeric');
      expect(checkUsernameValidity('username-')).toContain('lowercase alphanumeric');
      expect(checkUsernameValidity('-username-')).toContain('lowercase alphanumeric');
    });

    it('should reject usernames with consecutive hyphens', () => {
      expect(checkUsernameValidity('user--name')).toContain('lowercase alphanumeric');
      expect(checkUsernameValidity('user---name')).toContain('lowercase alphanumeric');
    });

    it('should allow valid username formats', () => {
      expect(checkUsernameValidity('myusername')).toBeUndefined();
      expect(checkUsernameValidity('cool-name')).toBeUndefined();
      expect(checkUsernameValidity('person123')).toBeUndefined();
      expect(checkUsernameValidity('123person')).toBeUndefined();
      expect(checkUsernameValidity('my-123-name')).toBeUndefined();
    });
  });
});