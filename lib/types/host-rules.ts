export interface HostRule {
  authType?: string;
  token?: string;
  username?: string;
  password?: string;
  insecureRegistry?: boolean;
  timeout?: number;
  abortOnError?: boolean;
  abortIgnoreStatusCodes?: number[];
  /**
   * Whether requests to this host may reach internal addresses.
   *
   * As they have been marked as trusted by the administrator:
   *
   * - when `internalHostAccess=block`, these are not blocked
   * - when `internalHostAccess=warn`, no warning occurs
   *
   * This is only allowed in global self-hosted configuration, and if found in repository or preset config, it is stripped.
   */
  allowInternal?: boolean;
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

/**
 * How the trusted host rules treat internal-host access for a request, computed by `find()`. Never settable through configuration: only rules from the administrator's own config, and from organization-inherited config the administrator has opted into trusting through `inheritConfigTrusted`, contribute to it.
 *
 * The administrator's own rules are resolved first, and an `allowInternal: false` of theirs vetoes every field below: inherited config can never re-grant a host the administrator refused, in any grant shape.
 */
export interface InternalHostGrant {
  /**
   * The `allowInternal` value of the matching trusted rules, with the most specific rule winning, and the administrator's own rules winning over inherited config's. `undefined` when none of them set it.
   */
  explicit?: boolean;
  /**
   * As `explicit`, but counting only rules deliberately scoped by a `hostType` or by a URL-prefix `matchHost`. Surfaces where a grant must be deliberate - such as HTTP presets, whose responses become config - check this value instead of `explicit`.
   */
  scoped?: boolean;
  /**
   * Whether any trusted rule naming a host (`matchHost`) matched the request: hosts named in configuration the administrator trusts are implicitly permitted. Always `false` under an administrator's veto.
   */
  implicit: boolean;
}

export type CombinedHostRule = Omit<
  HostRule,
  | 'encrypted'
  | 'hostType'
  | 'matchHost'
  | 'resolvedHost'
  | 'readOnly'
  | 'allowInternal'
> & {
  /** computed by `find()` - see {@link InternalHostGrant} */
  internalHostGrant?: InternalHostGrant;
};
