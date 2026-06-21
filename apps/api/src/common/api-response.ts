export interface ApiError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export interface ApiResponse<T> {
  data: T | null;
  meta: Record<string, unknown>;
  error: ApiError | null;
}

export function ok<T>(data: T, meta: Record<string, unknown> = {}): ApiResponse<T> {
  return {
    data,
    meta,
    error: null,
  };
}

export function fail(error: ApiError, meta: Record<string, unknown> = {}): ApiResponse<never> {
  return {
    data: null,
    meta,
    error,
  };
}
