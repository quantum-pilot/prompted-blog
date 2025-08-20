/** User Contract Schema Tests - TDD approach */
// @agent: cloudflare-backend
import { describe, it, expect } from 'vitest';
import {
  UserAccountSchema,
  CreateUserRequestSchema,
  CreateUserResponseSchema,
  GetUserRequestSchema,
  GetUserResponseSchema,
  UpdateUserProfileRequestSchema,
  UpdateUserProfileResponseSchema,
  CheckUsernameAvailabilityRequestSchema,
  CheckUsernameAvailabilityResponseSchema,
} from '../user.contract';

describe('User Contract Schemas', () => {
  const timestamp = Date.now();
  const validUser = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'user@example.com',
    provider: 'google',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  
  const validUserWithUsername = {
    ...validUser,
    username: 'john-doe',
  };

  describe('UserAccountSchema', () => {
    it('validates correct user account without username', () => {
      expect(UserAccountSchema.safeParse(validUser).success).toBe(true);
    });
    it('validates correct user account with username', () => {
      expect(UserAccountSchema.safeParse(validUserWithUsername).success).toBe(true);
    });
    it('validates valid usernames', () => {
      const validUsernames = ['abc', 'user123', 'john-doe', 'a'.repeat(30), 'test-user-123'];
      validUsernames.forEach(username => {
        expect(UserAccountSchema.safeParse({ ...validUser, username }).success).toBe(true);
      });
    });
    it('rejects invalid usernames', () => {
      const invalidUsernames = [
        'ab', // too short
        'a'.repeat(31), // too long
        'User123', // uppercase
        '-test', // starts with hyphen
        'test-', // ends with hyphen
        'test--user', // consecutive hyphens
        'test_user', // underscore
        'test user', // space
        'test@user', // special char
      ];
      invalidUsernames.forEach(username => {
        expect(UserAccountSchema.safeParse({ ...validUser, username }).success).toBe(false);
      });
    });
    it('rejects invalid email', () => {
      expect(UserAccountSchema.safeParse({ ...validUser, email: 'invalid' }).success).toBe(false);
    });
    it('rejects invalid provider', () => {
      expect(UserAccountSchema.safeParse({ ...validUser, provider: 'facebook' }).success).toBe(false);
    });
  });
  
  describe('CreateUserRequestSchema', () => {
    it('validates correct create request', () => {
      expect(CreateUserRequestSchema.safeParse({
        email: 'newuser@example.com', provider: 'github'
      }).success).toBe(true);
    });
  });
  
  describe('CreateUserResponseSchema', () => {
    it('validates success response', () => {
      expect(CreateUserResponseSchema.safeParse({
        success: true, user: validUser
      }).success).toBe(true);
    });
    it('validates error response', () => {
      expect(CreateUserResponseSchema.safeParse({
        success: false, error: 'user_exists', error_description: 'User already exists'
      }).success).toBe(true);
    });
  });
  
  describe('GetUserRequestSchema', () => {
    it('validates request with email', () => {
      expect(GetUserRequestSchema.safeParse({ email: 'user@example.com' }).success).toBe(true);
    });
    it('validates request with id', () => {
      expect(GetUserRequestSchema.safeParse({ 
        id: '550e8400-e29b-41d4-a716-446655440000' 
      }).success).toBe(true);
    });
    it('rejects request without email or id', () => {
      expect(GetUserRequestSchema.safeParse({}).success).toBe(false);
    });
  });
  
  describe('GetUserResponseSchema', () => {
    it('validates success response', () => {
      expect(GetUserResponseSchema.safeParse({
        success: true, user: validUser
      }).success).toBe(true);
    });
    it('validates error response', () => {
      expect(GetUserResponseSchema.safeParse({
        success: false, error: 'user_not_found', error_description: 'User not found'
      }).success).toBe(true);
    });
  });
  
  describe('UpdateUserProfileRequestSchema', () => {
    it('validates request with valid username', () => {
      expect(UpdateUserProfileRequestSchema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        username: 'new-username'
      }).success).toBe(true);
    });
    it('rejects request without id', () => {
      expect(UpdateUserProfileRequestSchema.safeParse({
        username: 'new-username'
      }).success).toBe(false);
    });
    it('rejects request with invalid username', () => {
      expect(UpdateUserProfileRequestSchema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        username: 'Invalid-Username'
      }).success).toBe(false);
    });
  });
  
  describe('UpdateUserProfileResponseSchema', () => {
    it('validates success response', () => {
      expect(UpdateUserProfileResponseSchema.safeParse({
        success: true,
        user: validUserWithUsername
      }).success).toBe(true);
    });
    it('validates username_taken error', () => {
      expect(UpdateUserProfileResponseSchema.safeParse({
        success: false,
        error: 'username_taken',
        error_description: 'Username is already taken'
      }).success).toBe(true);
    });
    it('validates username_invalid error', () => {
      expect(UpdateUserProfileResponseSchema.safeParse({
        success: false,
        error: 'username_invalid',
        error_description: 'Username format is invalid'
      }).success).toBe(true);
    });
    it('validates profile_update_failed error', () => {
      expect(UpdateUserProfileResponseSchema.safeParse({
        success: false,
        error: 'profile_update_failed',
        error_description: 'Failed to update profile'
      }).success).toBe(true);
    });
  });
  
  describe('CheckUsernameAvailabilityRequestSchema', () => {
    it('validates request with valid username', () => {
      expect(CheckUsernameAvailabilityRequestSchema.safeParse({
        username: 'check-username'
      }).success).toBe(true);
    });
    it('rejects request with invalid username', () => {
      expect(CheckUsernameAvailabilityRequestSchema.safeParse({
        username: 'INVALID'
      }).success).toBe(false);
    });
    it('rejects request without username', () => {
      expect(CheckUsernameAvailabilityRequestSchema.safeParse({}).success).toBe(false);
    });
  });
  
  describe('CheckUsernameAvailabilityResponseSchema', () => {
    it('validates available response', () => {
      expect(CheckUsernameAvailabilityResponseSchema.safeParse({
        success: true,
        available: true
      }).success).toBe(true);
    });
    it('validates unavailable response', () => {
      expect(CheckUsernameAvailabilityResponseSchema.safeParse({
        success: true,
        available: false
      }).success).toBe(true);
    });
    it('validates error response', () => {
      expect(CheckUsernameAvailabilityResponseSchema.safeParse({
        success: false,
        error: 'username_invalid',
        error_description: 'Invalid username format'
      }).success).toBe(true);
    });
  });
});