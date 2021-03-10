export interface HostRule {
  authType?: string;
  endpoint?: string;
  host?: string;
  hostType?: string;
  domainName?: string;
  hostName?: string;
  json?: true;
  baseUrl?: string;
  token?: string;
  username?: string;
  password?: string;
  insecureRegistry?: boolean;
  platform?: string;
  timeout?: number;
  encrypted?: HostRule;
  abortOnError?: boolean;
  abortIgnoreStatusCodes?: number[];
  enabled?: boolean;
  enableHttp2?: boolean;
  concurrentRequestLimit?: number;
}
