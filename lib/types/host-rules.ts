export interface HostRule {
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
  headers?: Record<string, string>;
  maxRetryAfter?: number;

  keepAlive?: boolean;
  artifactAuth?: string[] | null;
  httpsCertificateAuthority?: string;
  httpsPrivateKey?: string;
  httpsCertificate?: string;

  encrypted?: HostRule;
  hostType?: string;
  matchHost?: string;
  resolvedHost?: string;
  readOnly?: boolean;
}

export type CombinedHostRule = Omit<
  HostRule,
  'encrypted' | 'hostType' | 'matchHost' | 'resolvedHost' | 'readOnly'
>;
