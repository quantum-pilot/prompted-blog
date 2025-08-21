import { hc } from 'hono/client';
import type { AppType } from '../../workers/src/index';

export const createHonoClient = (workerUrl: string) => {
  return hc<AppType>(workerUrl, {
    init: {
      credentials: 'include', // This ensures cookies are sent with every request
      headers: {
        'Content-Type': 'application/json',
      },
    },
  });
};

const getDefaultWorkerUrl = (): string => {
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost') {
      return 'http://localhost:8787';
    }
    return window.location.origin;
  }
  return 'http://localhost:8787';
};

export const honoClient = createHonoClient(getDefaultWorkerUrl());

export default honoClient;
