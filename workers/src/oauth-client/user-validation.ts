// @agent: cloudflare-backend
import { z } from "zod";
import { UsernameBlocklist } from "./username-blocklist";

// Username validation: 3-30 chars, lowercase alphanumeric and hyphens only
// Cannot start/end with hyphen, no consecutive hyphens, and must not be blocked
export const UsernameSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'Username must be lowercase alphanumeric with hyphens (not at start/end, no consecutive)',
  })
  .refine((username) => !UsernameBlocklist.isBlocked(username), {
    message: 'This username is reserved or contains inappropriate terms',
  });

// Strict schema for allowed metadata fields
export const AllowedMetadataSchema = z.object({
  provider: z.string().max(100).optional(),
  lastLoginAt: z.string().datetime().optional(),
  loginCount: z.number().int().min(0).optional()
}).strict(); // .strict() ensures no additional properties

// Main user account schema with strict validation
export const UserAccountSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().max(255),
  username: UsernameSchema.optional(),
  name: z.string().max(1000).optional(),
  picture: z.string().url().max(1000).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  metadata: AllowedMetadataSchema.optional()
});

// Validated user account type
export type ValidatedUserAccount = z.infer<typeof UserAccountSchema>;

// Validation function with error handling
export function validateUserAccount(data: unknown): 
  { success: true; data: ValidatedUserAccount } | 
  { success: false; error: z.ZodError } {
  try {
    const validated = UserAccountSchema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error };
    }
    throw error;
  }
}

// Helper to sanitize user input before storage
export function sanitizeUserInput(input: {
  id?: string;
  email: string;
  username?: string;
  name?: string;
  picture?: string;
  provider?: string;
}): ValidatedUserAccount {
  // Check username against blocklist before processing
  if (input.username && UsernameBlocklist.isBlocked(input.username)) {
    throw new Error(UsernameBlocklist.getBlockReason(input.username));
  }
  
  const user = {
    id: input.id || crypto.randomUUID(),
    email: input.email,
    ...(input.username && { username: input.username }),
    ...(input.name && { name: input.name }),
    ...(input.picture && { picture: input.picture }),
    createdAt: new Date().toISOString(),
    metadata: input.provider ? { provider: input.provider } : undefined
  };
  
  const result = validateUserAccount(user);
  if (!result.success) {
    console.error("User validation failed:", result.error.issues);
    throw new Error("Invalid user data");
  }
  
  return result.data;
}