export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

export type ApiErrorResponse = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
};
