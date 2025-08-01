/**
 * Creates a singleton factory function for any class
 * Eliminates duplicate getInstance() patterns across services
 */
export function createSingleton<T>(constructor: any): () => T {
  let instance: T;
  return () => {
    if (!instance) instance = new constructor();
    return instance;
  };
}