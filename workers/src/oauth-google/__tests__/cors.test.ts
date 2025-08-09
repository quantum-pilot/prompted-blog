import { describe, it, expect } from 'vitest';
import { corsHeaders, handleCorsOptions } from '../cors';

describe('CORS Handling', () => {
  describe('corsHeaders', () => {
    it('should include all required CORS headers', () => {
      expect(corsHeaders['Access-Control-Allow-Origin']).toBe('*');
      expect(corsHeaders['Access-Control-Allow-Methods']).toContain('GET');
      expect(corsHeaders['Access-Control-Allow-Methods']).toContain('POST');
      expect(corsHeaders['Access-Control-Allow-Headers']).toContain('Content-Type');
      expect(corsHeaders['Access-Control-Max-Age']).toBe('86400');
    });
  });

  describe('handleCorsOptions', () => {
    it('should return 204 for OPTIONS requests', () => {
      const response = handleCorsOptions();
      
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should complete within 50ms', () => {
      const start = performance.now();
      handleCorsOptions();
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(50);
    });
  });
});