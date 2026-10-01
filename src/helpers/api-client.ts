import { expect, type APIRequestContext } from '@playwright/test';

export type RequestOptions = {
  /** JSON request body. */
  data?: object;
  /** Query string parameters. */
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  /** Fail when the status is not 2xx. Default true; set false to assert on the status in the test. */
  expectOk?: boolean;
};

export type ApiResult<T = unknown> = { status: number; body: T };

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

/** Generic HTTP helper on top of Playwright's request context. Knows nothing about DemoBlaze. */
export class ApiClient {
  constructor(private readonly request: APIRequestContext) {}

  get<T = unknown>(path: string, options?: RequestOptions) {
    return this.call<T>('GET', path, options);
  }

  post<T = unknown>(path: string, options?: RequestOptions) {
    return this.call<T>('POST', path, options);
  }

  put<T = unknown>(path: string, options?: RequestOptions) {
    return this.call<T>('PUT', path, options);
  }

  delete<T = unknown>(path: string, options?: RequestOptions) {
    return this.call<T>('DELETE', path, options);
  }

  private async call<T>(method: Method, path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
    const { expectOk = true, ...requestOptions } = options;
    const response = await this.request.fetch(path, { method, ...requestOptions });
    if (expectOk) expect(response.ok(), `${method} ${path} returned HTTP ${response.status()}`).toBeTruthy();
    return { status: response.status(), body: parseBody(await response.text()) as T };
  }
}

/** JSON when the body is JSON, otherwise the raw text (empty body, HTML error page). */
function parseBody(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
