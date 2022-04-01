export interface HostRule {
  authType?: string;
  hostType?: string;
  matchHost?: string;
  token?: string;
  username?: string;
  password?: string;
  insecureRegistry?: boolean;
  timeout?: number;
  encrypted?: HostRule;
  abortOnError?: boolean;
  abortIgnoreStatusCodes?: number[];
  enabled?: boolean;
  enableHttp2?: boolean;
  concurrentRequestLimit?: number;
  resolvedHost?: string;
  githubTokenWarn?: boolean;
}
