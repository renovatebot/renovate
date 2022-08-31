export interface HostRuleSearchResult {
  authType?: string;
  token?: string;
  username?: string;
  password?: string;
  insecureRegistry?: boolean;
  timeout?: number;
  abortOnError?: boolean;
  abortIgnoreStatusCodes?: number[];
  enabled?: boolean;
  enableHttp2?: boolean;
  concurrentRequestLimit?: number;

  dnsCache?: boolean;
}

export interface HostRule extends HostRuleSearchResult {
  encrypted?: HostRule;
  hostType?: string;
  matchHost?: string;
  resolvedHost?: string;
}
