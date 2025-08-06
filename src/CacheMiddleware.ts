interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
}

class InMemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly defaultTtl: number;
  private readonly maxSize: number;

  constructor(options: CacheOptions = {}) {
    this.defaultTtl = options.ttl || 5 * 60 * 1000; // 5 minutes default
    this.maxSize = options.maxSize || 100; // 100 entries default
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTtl,
    };

    this.cache.set(key, entry);
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

// Global cache instance
const cache = new InMemoryCache({
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 50,
});

export const cacheMiddleware = (options: CacheOptions = {}) => {
  const cacheInstance = new InMemoryCache(options);

  return async (c: any, next: () => Promise<void>) => {
    const url = c.req.url;
    const method = c.req.method;

    // Only cache GET requests
    if (method !== "GET") {
      return next();
    }

    const cacheKey = `cache:${method}:${url}`;
    const cachedResponse = cacheInstance.get(cacheKey);

    if (cachedResponse) {
      return c.json(cachedResponse);
    }

    // Store original json method
    const originalJson = c.json.bind(c);

    // Override json method to cache the response
    c.json = (data: any) => {
      cacheInstance.set(cacheKey, data);
      return originalJson(data);
    };

    await next();
  };
};

// Utility functions for manual cache management
export const getCachedData = <T>(key: string): T | null => {
  return cache.get<T>(key);
};

export const setCachedData = <T>(key: string, data: T, ttl?: number): void => {
  cache.set(key, data, ttl);
};

export const clearCache = (): void => {
  cache.clear();
};

export const getCacheSize = (): number => {
  return cache.size();
};
