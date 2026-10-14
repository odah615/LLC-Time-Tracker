export interface EnvConfig {
  LIVE_APPS_SCRIPT_URL: string;
  LIVE_APPS_SCRIPT_SECRET: string;
  JWT_SECRET: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  url?: string;
  secret?: string;
}

export interface ForwardResult {
  success: boolean;
  status: number;
  appsScriptStatus?: string;
  action?: string;
  result?: any;
  error?: string;
}

export interface JwtVerifyResult {
  valid: boolean;
  error?: string;
  payload?: Record<string, any>;
}

export function parseCsvRows(csvText: string): string[][];
export function fetchLiveEmployeeDirectory(customEnv?: Record<string, any>): Promise<any[]>;
export function authenticateEmployeeAuthoritatively(
  usernameOrCode: string,
  inputPassword: string,
  customEnv?: Record<string, any>
): Promise<{
  success: boolean;
  valid: boolean;
  mustChangePassword?: boolean;
  user?: any;
  message?: string;
  code?: string;
  error?: string;
}>;

export function getEnvConfig(customEnv?: Record<string, any>): EnvConfig;
export function validateAppsScriptConfig(customEnv?: Record<string, any>): ValidationResult;
export function validateJwtConfig(customEnv?: Record<string, any>): ValidationResult;
export function sanitizeOutput<T>(data: T): T;
export function safeLog(level: string, message: string, meta?: any, customEnv?: Record<string, any>): void;
export function createJwtToken(payload: Record<string, any>, customEnv?: Record<string, any>, expiresInSeconds?: number): string;
export function verifyJwtToken(token: string, customEnv?: Record<string, any>): JwtVerifyResult;
export function extractBearerToken(authHeader?: string): string | null;
export function forwardToLiveAppsScript(incomingPayload: any, options?: { timeoutMs?: number }, customEnv?: Record<string, any>): Promise<ForwardResult>;
export function handleExpressSyncSheetsPost(req: any, res: any, customEnv?: Record<string, any>): Promise<any>;
export function handleExpressSyncSheetsGet(req: any, res: any, customEnv?: Record<string, any>): Promise<any>;

declare const _default: {
  parseCsvRows: typeof parseCsvRows;
  fetchLiveEmployeeDirectory: typeof fetchLiveEmployeeDirectory;
  authenticateEmployeeAuthoritatively: typeof authenticateEmployeeAuthoritatively;
  getEnvConfig: typeof getEnvConfig;
  validateAppsScriptConfig: typeof validateAppsScriptConfig;
  validateJwtConfig: typeof validateJwtConfig;
  sanitizeOutput: typeof sanitizeOutput;
  safeLog: typeof safeLog;
  createJwtToken: typeof createJwtToken;
  verifyJwtToken: typeof verifyJwtToken;
  extractBearerToken: typeof extractBearerToken;
  forwardToLiveAppsScript: typeof forwardToLiveAppsScript;
  handleExpressSyncSheetsPost: typeof handleExpressSyncSheetsPost;
  handleExpressSyncSheetsGet: typeof handleExpressSyncSheetsGet;
};

export default _default;
