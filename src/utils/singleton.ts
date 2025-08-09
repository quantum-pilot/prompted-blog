export function createSingleton<T>(constructor: any): () => T {
  let instance: T;
  return () => {
    if (!instance) instance = new constructor();
    return instance;
  };
}
