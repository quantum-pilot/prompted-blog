/**
 * Health Check Contract Schema Definitions
 * Contract-first API schemas for health check endpoint using Zod
 */

import { z } from 'zod';

// ===========================
// Health Check Endpoint
// ===========================

export const HealthCheckResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.number().int().positive(),
  version: z.string().optional(),
  environment: z.string().optional(),
});

export const HealthCheckErrorSchema = z.object({
  status: z.literal('error'),
  timestamp: z.number().int().positive(),
  error: z.string().min(1),
  details: z.record(z.string(), z.any()).optional(),
});

export const HealthResponseSchema = z.union([
  HealthCheckResponseSchema,
  HealthCheckErrorSchema,
]);

// ===========================
// Type Exports
// ===========================

export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
export type HealthCheckError = z.infer<typeof HealthCheckErrorSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;