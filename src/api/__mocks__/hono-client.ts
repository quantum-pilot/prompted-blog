/**
 * Mock Hono client for testing
 */

import { vi } from 'vitest';

// Create a mock Hono client that directly uses global.fetch
export const createHonoClient = (workerUrl: string) => {
  return {
    oauth: {
      callback: {
        $post: vi.fn(async ({ json }: { json: any }) => {
          // Directly use global.fetch which is mocked in the test
          return global.fetch(`${workerUrl}/oauth/callback`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(json),
          });
        }),
      },
      session: {
        $get: vi.fn(async (_: any, options?: { headers?: HeadersInit }) => {
          // Directly use global.fetch which is mocked in the test
          return global.fetch(`${workerUrl}/oauth/session`, {
            method: 'GET',
            headers: options?.headers || {},
            credentials: 'include',
          });
        }),
      },
    },
  };
};

export const getAuthHeaders = (sessionId: string): HeadersInit => {
  return {
    'Authorization': `Bearer ${sessionId}`,
    'Content-Type': 'application/json',
  };
};