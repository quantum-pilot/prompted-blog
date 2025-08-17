// @agent: cloudflare-backend
// Metadata management for RequestContext

export class ContextMetadata {
  private metadata: Map<string, any> = new Map();

  set(key: string, value: any): void {
    this.metadata.set(key, value);
  }

  get(key: string): any {
    return this.metadata.get(key);
  }

  getAll(): Map<string, any> {
    return new Map(this.metadata);
  }

  copyTo(target: ContextMetadata): void {
    this.metadata.forEach((value, key) => {
      target.set(key, value);
    });
  }
}
