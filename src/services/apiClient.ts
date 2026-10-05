/**
 * Centralized API Client with error handling, token refresh, timeout, and caching.
 */

const DEFAULT_TIMEOUT = 15000; // 15 seconds
const PRESETS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface QueuedRequest {
  resolve: (value: Response) => void;
  reject: (reason: unknown) => void;
  config: RequestConfig;
}

interface RequestConfig {
  url: string;
  options: RequestInit;
  skipAuth?: boolean;
}

class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private refreshPromise: Promise<boolean> | null = null;
  private requestQueue: QueuedRequest[] = [];

  constructor(baseUrl = '', timeout = DEFAULT_TIMEOUT) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * Gets the access token from localStorage.
   */
  private getAccessToken(): string | null {
    return localStorage.getItem('evbms_access_token');
  }

  /**
   * Gets the refresh token from localStorage.
   */
  private getRefreshToken(): string | null {
    return localStorage.getItem('evbms_refresh_token');
  }

  /**
   * Attempts to refresh the access token using the refresh token.
   */
  private async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      if (data.accessToken) {
        localStorage.setItem('evbms_access_token', data.accessToken);
        if (data.refreshToken) {
          localStorage.setItem('evbms_refresh_token', data.refreshToken);
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Processes queued requests after a successful token refresh.
   */
  private processQueue(): void {
    const queue = [...this.requestQueue];
    this.requestQueue = [];
    queue.forEach(({ resolve, reject, config }) => {
      this.executeRequest(config).then(resolve).catch(reject);
    });
  }

  /**
   * Executes a fetch request with timeout handling.
   */
  private async executeRequest(config: RequestConfig): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((config.options.headers as Record<string, string>) || {}),
      };

      if (!config.skipAuth) {
        const token = this.getAccessToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(`${this.baseUrl}${config.url}`, {
        ...config.options,
        headers,
        signal: controller.signal,
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Handles 401 responses by attempting token refresh and retrying.
   */
  private async handleRequest(config: RequestConfig): Promise<Response> {
    const response = await this.executeRequest(config);

    if (response.status === 401 && !config.skipAuth) {
      // Prevent multiple simultaneous refresh attempts
      if (!this.refreshPromise) {
        this.refreshPromise = this.refreshAccessToken().finally(() => {
          this.refreshPromise = null;
        });
      }

      const refreshed = await this.refreshPromise;

      if (refreshed) {
        // Retry the original request with the new token
        return this.executeRequest(config);
      } else {
        // Refresh failed — reject this request
        throw new ApiError('Session expired. Please log in again.', 401);
      }
    }

    return response;
  }

  /**
   * Parses the response and throws an ApiError for non-OK responses.
   */
  private async parseResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errorBody = await response.json();
        if (errorBody.error) {
          errorMessage = errorBody.error;
        }
      } catch {
        // Response body wasn't JSON
      }
      throw new ApiError(errorMessage, response.status);
    }
    return response.json() as Promise<T>;
  }

  /**
   * Checks if a cached entry is still valid.
   */
  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > PRESETS_CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  /**
   * Stores a value in the cache.
   */
  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  // ── Public HTTP Methods ──────────────────────────────────────────

  async get<T>(url: string, skipCache = false): Promise<T> {
    const cacheKey = `GET:${url}`;
    if (!skipCache) {
      const cached = this.getCached<T>(cacheKey);
      if (cached) return cached;
    }

    const response = await this.handleRequest({ url, options: { method: 'GET' } });
    const data = await this.parseResponse<T>(response);
    this.setCache(cacheKey, data);
    return data;
  }

  async post<T>(url: string, body?: unknown): Promise<T> {
    const response = await this.handleRequest({
      url,
      options: {
        method: 'POST',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      },
    });
    return this.parseResponse<T>(response);
  }

  async put<T>(url: string, body?: unknown): Promise<T> {
    const response = await this.handleRequest({
      url,
      options: {
        method: 'PUT',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      },
    });
    return this.parseResponse<T>(response);
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.handleRequest({ url, options: { method: 'DELETE' } });
    return this.parseResponse<T>(response);
  }

  /**
   * Sends a batch of POST requests and returns all responses.
   */
  async postBatch<T>(url: string, bodies: unknown[]): Promise<T[]> {
    const requests = bodies.map((body) =>
      this.handleRequest({
        url,
        options: {
          method: 'POST',
          body: JSON.stringify(body),
        },
      }).then((response) => this.parseResponse<T>(response))
    );
    return Promise.all(requests);
  }

  /**
   * Clears the response cache.
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Custom API error class with status code.
 */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const apiClient = new ApiClient();
