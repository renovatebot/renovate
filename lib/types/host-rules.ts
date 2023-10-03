export interface HostRuleSearchResult extends Record<string, any> {
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
  maxRequestsPerSecond?: number;

  dnsCache?: boolean;
  keepalive?: boolean;
  artifactAuth?: string[] | null;
  httpsCertificateAuthority?: string;
  httpsPrivateKey?: string;
  httpsCertificate?: string;
}

export interface HostRule extends HostRuleSearchResult {
  encrypted?: HostRule;
  hostType?: string;
  matchHost?: string;
  resolvedHost?: string;
}
