/** User Contract Schema Tests - TDD approach */
import { describe, it, expect } from 'vitest';
import {
  UserAccountSchema,
  CreateUserRequestSchema,
  CreateUserResponseSchema,
  GetUserRequestSchema,
  GetUserResponseSchema,
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

  describe('UserAccountSchema', () => {
    it('validates correct user account', () => {
      expect(UserAccountSchema.safeParse(validUser).success).toBe(true);
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
});