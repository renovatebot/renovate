import { logger, partial } from '~test/util.ts';
import { GlobalConfig } from '../config/global.ts';
import { NugetDatasource } from '../modules/datasource/nuget/index.ts';
import type { HostRule } from '../types/index.ts';
import {
  type LegacyHostRule,
  add,
  clear,
  confidentialFields,
  detachUrlCredentials,
  filterAllowedHeaders,
  find,
  findAll,
  findDetachedCredentials,
  getAll,
  getDetachedCredentialsHash,
  hasDetachedCredentials,
  hostType,
  hosts,
  matchesHost,
  usesGithubUrlFallback,
} from './host-rules.ts';
import { redactedFields, sanitize } from './sanitize.ts';
import { hasUrlCredentials } from './url.ts';

describe('util/host-rules', () => {
  beforeEach(() => {
    clear();
    // `add()` filters `headers` against `allowedHeaders`
    GlobalConfig.set({ allowedHeaders: ['X-*'] });
  });

  it('registers every redactedFields entry that is a HostRule field for value-level sanitizing', () => {
    // exhaustive check for fields of `HostRule`, to introduce a compile-time error when adding a new field to `HostRule`
    const allHostRuleFields: Record<keyof HostRule, true> = {
      authType: true,
      token: true,
      username: true,
      password: true,
      insecureRegistry: true,
      timeout: true,
      abortOnError: true,
      abortIgnoreStatusCodes: true,
      allowInternal: true,
      enabled: true,
      enableHttp2: true,
      concurrentRequestLimit: true,
      maxRequestsPerSecond: true,
      headers: true,
      maxRetryAfter: true,
      keepAlive: true,
      artifactAuth: true,
      httpsCertificateAuthority: true,
      httpsPrivateKey: true,
      httpsCertificate: true,
      encrypted: true,
      hostType: true,
      matchHost: true,
      resolvedHost: true,
      readOnly: true,
    };

    const expectedConfidentialFields = redactedFields.filter(
      (field) => field in allHostRuleFields,
    );

    expect([...confidentialFields].sort()).toEqual(
      expectedConfidentialFields.sort(),
    );
  });

  describe('add()', () => {
    it('throws if both domainName and hostName', () => {
      expect(() =>
        add(
          partial<LegacyHostRule & HostRule>({
            hostType: 'azure',
            domainName: 'github.com',
            hostName: 'api.github.com',
          }),
        ),
      ).toThrow(
        'hostRules cannot contain more than one host-matching field - use',
      );
    });

    it('throws if both domainName and baseUrl', () => {
      expect(() =>
        add(
          partial<LegacyHostRule & HostRule>({
            hostType: 'azure',
            domainName: 'github.com',
            matchHost: 'https://api.github.com',
          }),
        ),
      ).toThrow(
        'hostRules cannot contain more than one host-matching field - use',
      );
    });

    it('throws if both hostName and baseUrl', () => {
      expect(() =>
        add(
          partial<LegacyHostRule & HostRule>({
            hostType: 'azure',
            hostName: 'api.github.com',
            matchHost: 'https://api.github.com',
          }),
        ),
      ).toThrow(
        'hostRules cannot contain more than one host-matching field - use',
      );
    });

    it('supports baseUrl-only', () => {
      add({
        matchHost: 'https://some.endpoint',
        username: 'user1',
        password: 'pass1',
      });
      expect(find({ url: 'https://some.endpoint/v3/' })).toEqual({
        password: 'pass1',
        username: 'user1',
      });
      expect(find({ url: 'https://some.endpoint/' })).toEqual({
        password: 'pass1',
        username: 'user1',
      });
      expect(find({ url: 'https://some.endpoint' })).toEqual({
        password: 'pass1',
        username: 'user1',
      });
      expect(find({ url: 'https://some.endpoint:443' })).toEqual({
        password: 'pass1',
        username: 'user1',
      });
    });

    it('does not match subpart of hostname', () => {
      add({
        matchHost: 'https://some.endpoint',
        username: 'user1',
        password: 'pass1',
      });
      expect(find({ url: 'https://some.endpoint.example.com' })).toEqual({});
      expect(find({ url: 'https://some.endpoint:blub@example.com' })).toEqual(
        {},
      );
    });

    it('massages host url', () => {
      add({
        matchHost: 'some.domain.com:8080',
        username: 'user1',
        password: 'pass1',
      });
      add({
        matchHost: 'domain.com/',
        username: 'user2',
        password: 'pass2',
      });
      expect(find({ url: 'https://some.domain.com:8080' })).toEqual({
        password: 'pass1',
        username: 'user1',
      });
      expect(find({ url: 'https://domain.com/' })).toEqual({
        password: 'pass2',
        username: 'user2',
      });
    });

    it('sanitizes TLS credential values', () => {
      add({
        matchHost: 'https://some.endpoint',
        httpsPrivateKey: 'private-key-value',
        httpsCertificate: 'certificate-value',
        httpsCertificateAuthority: 'certificate-authority-value',
      });
      expect(
        sanitize(
          'key=private-key-value cert=certificate-value ca=certificate-authority-value',
        ),
      ).toBe('key=**redacted** cert=**redacted** ca=**redacted**');
    });

    it('sanitizes a short password', () => {
      add(
        { matchHost: 'https://some.endpoint', password: 'short' },
        { trusted: true },
      );

      expect(sanitize('short/foo')).toBe('**redacted**/foo');
    });

    it('drops headers not permitted by allowedHeaders, with a warning', () => {
      // enforced within `add()` itself, so that no registration path (config, .npmrc, a future caller) can bypass `allowedHeaders`
      add({
        matchHost: 'registry.example.com',
        headers: { 'X-Allowed': 'yes', Authorization: 'denied' },
      });

      expect(find({ url: 'https://registry.example.com' })).toEqual({
        headers: { 'X-Allowed': 'yes' },
        trustedHeaderNames: [],
      });
      expect(logger.logger.warn).toHaveBeenCalledWith(
        { denied: ['Authorization'] },
        "Ignoring hostRules headers not permitted by this Renovate instance's `allowedHeaders`",
      );
    });

    it('drops all headers when allowedHeaders is unset (deny by default)', () => {
      GlobalConfig.reset();

      add({
        matchHost: 'registry.example.com',
        headers: { anything: 'x' },
      });

      expect(find({ url: 'https://registry.example.com' })).toEqual({});
    });

    it('does not filter a trusted rule against allowedHeaders', () => {
      // `allowedHeaders` constrains what a repository or preset may set, not the self-hosted administrator - mirrors `allowedEnv`'s exemption of the admin's own `env`
      GlobalConfig.reset();

      add(
        {
          matchHost: 'registry.example.com',
          headers: { Authorization: 'from-admin' },
        },
        { trusted: true },
      );

      expect(find({ url: 'https://registry.example.com' })).toEqual({
        headers: { Authorization: 'from-admin' },
        internalHostGrant: { implicit: true },
        trustedHeaderNames: ['Authorization'],
      });
      expect(logger.logger.warn).not.toHaveBeenCalled();
    });
  });

  /**
   * Moves the credentials of `url` into host rules for the `npm` host type.
   */
  function detach(url: string): string {
    return detachUrlCredentials(url, ['npm']);
  }

  /**
   * Returns the host rule for an `npm` request of `url`.
   */
  function findNpm(url: string): ReturnType<typeof find> {
    return find({ hostType: 'npm', url });
  }

  describe('detachUrlCredentials()', () => {
    it('returns a URL without credentials unchanged', () => {
      expect(detach('https://reg.example.com/@scope')).toBe(
        'https://reg.example.com/@scope',
      );
      expect(detach('https://reg.example.com/npm')).toBe(
        'https://reg.example.com/npm',
      );
      expect(findNpm('https://reg.example.com/npm')).toEqual({});
    });

    it('leaves non-http URLs alone', () => {
      expect(detach('s3://user:pass@bucket/path')).toBe(
        's3://user:pass@bucket/path',
      );
      expect(findNpm('s3://bucket/path')).toEqual({});
    });

    it('leaves a placeholder username alone', () => {
      const url =
        'https://oauth2accesstoken@region-python.pkg.dev/project/repo/simple/';

      expect(detach(url)).toBe(url);
      expect(findNpm(url)).toEqual({});
    });

    it('strips a template placeholder without registering it', () => {
      expect(detach('https://${USER}:${PASS}@reg.example.com/simple/')).toBe(
        'https://reg.example.com/simple/',
      );
      expect(detach('https://${TOKEN}@reg.example.com/')).toBe(
        'https://reg.example.com/',
      );
      expect(findNpm('https://reg.example.com/simple/pkg')).toEqual({});
    });

    it.each`
      userinfo
      ${'{{ user }}:{{ pass }}'}
      ${'user:{{pass}}'}
      ${'{{token}}'}
      ${'${USER}:${PASS}'}
      ${'user:${PASS}'}
      ${'$USER:$PASS'}
      ${'$TOKEN_0123456789AB'}
      ${'user:${{secrets.TOKEN}}'}
      ${'user:${env.TOKEN}'}
      ${'user:%24%7BTOKEN%3A%3Funset%7D'}
    `(
      'strips the template placeholder $userinfo without registering it',
      ({ userinfo }) => {
        expect(detach(`https://${userinfo}@reg.example.com/simple/`)).toBe(
          'https://reg.example.com/simple/',
        );
        expect(findNpm('https://reg.example.com/simple/pkg')).toEqual({});
      },
    );

    it.each`
      userinfo                 | username                 | password
      ${'user:p4$$word'}       | ${'user'}                | ${'p4$$word'}
      ${'$user:$pass'}         | ${'$user'}               | ${'$pass'}
      ${'user:$ecret'}         | ${'user'}                | ${'$ecret'}
      ${'$token_0123456789ab'} | ${'$token_0123456789ab'} | ${''}
      ${'user:${PASS:-x}'}     | ${'user'}                | ${'${PASS:-x}'}
      ${'user:pre${X}'}        | ${'user'}                | ${'pre${X}'}
      ${'user:${PASS'}         | ${'user'}                | ${'${PASS'}
      ${'user:${PASS}x'}       | ${'user'}                | ${'${PASS}x'}
      ${'${USER_0123456789AB'} | ${'${USER_0123456789AB'} | ${''}
      ${'user:{{pass}}x'}      | ${'user'}                | ${'{{pass}}x'}
    `(
      'registers the credentials of $userinfo which is not a single template placeholder',
      ({ userinfo, username, password }) => {
        expect(detach(`https://${userinfo}@reg.example.com/`)).toBe(
          'https://reg.example.com/',
        );
        expect(findNpm('https://reg.example.com/pkg')).toMatchObject({
          username,
          password,
        });
      },
    );

    it.each`
      userinfo                                        | username        | password
      ${'${CI_USER}:glpat-AbCdEf0123456789xyz'}       | ${'${CI_USER}'} | ${'glpat-AbCdEf0123456789xyz'}
      ${'{{user}}:glpat-AbCdEf0123456789xyz'}         | ${'{{user}}'}   | ${'glpat-AbCdEf0123456789xyz'}
      ${'$CI_USER:glpat-AbCdEf0123456789xyz'}         | ${'$CI_USER'}   | ${'glpat-AbCdEf0123456789xyz'}
      ${'%24%7BCI_USER%7D:glpat-AbCdEf0123456789xyz'} | ${'${CI_USER}'} | ${'glpat-AbCdEf0123456789xyz'}
    `(
      'registers and sanitizes the literal password next to the placeholder username of $userinfo',
      ({ userinfo, username, password }) => {
        const url = `https://${userinfo}@gitlab.example.com/api/v4/projects/1/packages/pypi/simple`;

        expect(detach(url)).toBe(
          'https://gitlab.example.com/api/v4/projects/1/packages/pypi/simple',
        );
        // as `withoutUrlCredentials()` and the other users of `isCredentialUserinfo()` read it
        expect(hasUrlCredentials(url)).toBeTrue();
        expect(
          findNpm(
            'https://gitlab.example.com/api/v4/projects/1/packages/pypi/simple/pkg',
          ),
        ).toMatchObject({ username, password });
        expect(sanitize(`token ${password}`)).toBe('token **redacted**');
      },
    );

    it.each`
      url
      ${'https://us er:pa ss@reg.example.com/path'}
      ${'https://us%20er:pa%20ss@reg.example.com/path'}
    `(
      'moves a userinfo containing whitespace of $url into a host rule',
      ({ url }) => {
        expect(detach(url)).toBe('https://reg.example.com/path');
        expect(findNpm('https://reg.example.com/path')).toMatchObject({
          username: 'us er',
          password: 'pa ss',
        });
      },
    );

    it('keeps a URL inside the query when removing the userinfo', () => {
      expect(
        detach(
          'https://user:pass@reg.example.com/?next=https://a:b@other.example.com/',
        ),
      ).toBe('https://reg.example.com/?next=https://a:b@other.example.com/');
    });

    it('moves username and password into a host rule for the path of the URL', () => {
      expect(detach('https://us%40er:p%3Ass@reg.example.com/npm')).toBe(
        'https://reg.example.com/npm',
      );

      expect(findNpm('https://reg.example.com/npm/pkg')).toMatchObject({
        username: 'us@er',
        password: 'p:ss',
      });
      expect(findNpm('https://reg.example.com/npm2').username).toBeUndefined();
      expect(findNpm('https://other.example.com/npm').username).toBeUndefined();
    });

    it.each`
      hostTypes
      ${['npm']}
      ${['npm', 'npm']}
    `(
      'registers one host rule per host type in $hostTypes',
      ({ hostTypes }) => {
        detachUrlCredentials('https://user:pass@reg.example.com/npm', [
          ...hostTypes,
          'maven',
        ]);

        expect(
          find({ hostType: 'maven', url: 'https://reg.example.com/npm/pkg' }),
        ).toMatchObject({ username: 'user', password: 'pass' });
        expect(findNpm('https://reg.example.com/npm/pkg')).toMatchObject({
          username: 'user',
          password: 'pass',
        });
        expect(
          find({ hostType: 'pypi', url: 'https://reg.example.com/npm/pkg' }),
        ).toEqual({});
        expect(find({ url: 'https://reg.example.com/npm/pkg' })).toEqual({});
      },
    );

    it('drops the credentials without a host type, but sanitizes them', () => {
      expect(
        detachUrlCredentials(
          'https://user:abcdefghijklmnopqrst@reg.example.com/npm',
          [],
        ),
      ).toBe('https://reg.example.com/npm');

      expect(findNpm('https://reg.example.com/npm/pkg')).toEqual({});
      expect(
        getDetachedCredentialsHash('https://reg.example.com/npm'),
      ).toBeNull();
      expect(sanitize('abcdefghijklmnopqrst')).toBe('**redacted**');
    });

    it('leaves the detached host rules out of the configured ones', () => {
      add(
        { hostType: 'npm', matchHost: 'other.example.com', token: 'abc' },
        { trusted: true },
      );

      detach('https://user:pass@reg.example.com/npm');

      expect(getAll()).toMatchObject([{ matchHost: 'other.example.com' }]);
      expect(getAll()).toHaveLength(1);
      expect(findAll({ hostType: 'npm' })).toHaveLength(1);
      expect(hosts({ hostType: 'npm' })).toEqual(['other.example.com']);
      expect(hostType({ url: 'https://reg.example.com/npm/pkg' })).toBeNull();
    });

    it.each`
      url
      ${'https://gitlab.com/api/v4/projects/1/packages/maven'}
      ${'https://gitlab.com/api/v4/projects/1/packages/maven/'}
      ${'https://gitlab.com/api/v4/projects/1/packages/maven?page=2'}
      ${'https://gitlab.com/api/v4/projects/1/packages/maven/com/example/lib/maven-metadata.xml'}
    `('applies the credentials of a URL to $url', ({ url }) => {
      detach('https://u1:t1@gitlab.com/api/v4/projects/1/packages/maven');

      expect(findNpm(url)).toMatchObject({ username: 'u1', password: 't1' });
    });

    it.each`
      url
      ${'https://gitlab.com/'}
      ${'https://gitlab.com/api/v4/projects/1'}
      ${'https://gitlab.com/api/v4/projects/1/packages/npm'}
      ${'https://gitlab.com/api/v4/projects/1/packages/maven2'}
      ${'https://gitlab.com/api/v4/projects/10/packages/maven'}
    `('does not apply the credentials of a URL to $url', ({ url }) => {
      detach('https://u1:t1@gitlab.com/api/v4/projects/1/packages/maven');

      expect(findNpm(url).username).toBeUndefined();
    });

    it('keeps the credentials of two URLs of one origin apart', () => {
      detach('https://u1:t1@gitlab.com/api/v4/projects/1');
      detach('https://u10:t10@gitlab.com/api/v4/projects/10');

      expect(
        findNpm('https://gitlab.com/api/v4/projects/1/packages/maven'),
      ).toMatchObject({ username: 'u1', password: 't1' });
      expect(
        findNpm('https://gitlab.com/api/v4/projects/10/packages/maven'),
      ).toMatchObject({ username: 'u10', password: 't10' });
    });

    it.each`
      first                                                    | second
      ${'https://u1:p1@nexus.example.com/'}                    | ${'https://u2:p2@nexus.example.com/repository/private/'}
      ${'https://u2:p2@nexus.example.com/repository/private/'} | ${'https://u1:p1@nexus.example.com/'}
    `(
      'registers the credentials of a path and of a path below it after $first',
      ({ first, second }) => {
        detach(first);
        detach(second);

        expect(
          findNpm('https://nexus.example.com/repository/private/pkg'),
        ).toMatchObject({ username: 'u2', password: 'p2' });
        expect(
          findNpm('https://nexus.example.com/repository/public/pkg'),
        ).toMatchObject({ username: 'u1', password: 'p1' });
      },
    );

    it.each`
      hostType
      ${undefined}
      ${'maven'}
    `(
      'leaves the credentials of a $hostType rule for a path below the URL in place',
      ({ hostType }) => {
        add(
          {
            hostType,
            matchHost: 'https://nexus.example.com/repository/npm/',
            token: 'admin',
          },
          { trusted: true },
        );

        expect(
          detachUrlCredentials('https://user:secret@nexus.example.com', [
            'maven',
          ]),
        ).toBe('https://nexus.example.com');

        expect(
          find({ hostType: 'maven', url: 'https://nexus.example.com/pkg' })
            .password,
        ).toBeUndefined();
        const res = find({
          hostType,
          url: 'https://nexus.example.com/repository/npm/pkg',
        });
        expect(res.token).toBe('admin');
        expect(res.password).toBeUndefined();
        expect(
          getDetachedCredentialsHash('https://nexus.example.com/'),
        ).toBeNull();
      },
    );

    it.each`
      hostType         | platform
      ${'github-tags'} | ${'github'}
      ${'gitlab-tags'} | ${'gitlab'}
      ${'gitea-tags'}  | ${'gitea'}
    `(
      'leaves the credentials of a $platform rule without matchHost in place for $hostType',
      ({ hostType, platform }) => {
        add({ hostType: platform, token: 'admin' }, { trusted: true });

        expect(
          detachUrlCredentials('https://user:pass@git.example.com/owner/repo', [
            hostType,
          ]),
        ).toBe('https://git.example.com/owner/repo');

        expect(
          find({ hostType, url: 'https://git.example.com/owner/repo' }),
        ).toEqual({});
      },
    );

    it('registers credentials next to a rule without matchHost for a platform without fallback', () => {
      add({ hostType: 'azure', token: 'admin' }, { trusted: true });

      detachUrlCredentials('https://user:pass@dev.example.com/org', [
        'azure-tags',
      ]);

      expect(
        find({ hostType: 'azure-tags', url: 'https://dev.example.com/org' }),
      ).toMatchObject({ username: 'user', password: 'pass' });
      expect(
        find({ hostType: 'azure', url: 'https://dev.example.com/org' }),
      ).toEqual({ token: 'admin' });
    });

    it('keeps the port in the host rule', () => {
      expect(detach('https://user:pass@reg.example.com:8443/npm')).toBe(
        'https://reg.example.com:8443/npm',
      );

      expect(findNpm('https://reg.example.com:8443/npm/pkg')).toMatchObject({
        username: 'user',
        password: 'pass',
      });
      expect(
        findNpm('https://reg.example.com/npm/pkg').username,
      ).toBeUndefined();
    });

    it('keeps a password which is not valid percent-encoding as is', () => {
      expect(detach('https://user:100%pa@reg.example.com/')).toBe(
        'https://reg.example.com/',
      );
      expect(findNpm('https://reg.example.com/pkg')).toMatchObject({
        username: 'user',
        password: '100%pa',
      });
    });

    it.each`
      username
      ${'ghp_abcdefghijklmnopqrstuvwxyz0123456789'}
      ${'abcdefghijklmnop'}
    `(
      'treats a lone $username as the username of Basic auth and sanitizes it',
      ({ username }) => {
        expect(detach(`https://${username}@reg.example.com`)).toBe(
          'https://reg.example.com',
        );
        expect(findNpm('https://reg.example.com/pkg')).toMatchObject({
          username,
          password: '',
        });
        expect(sanitize(username)).toBe('**redacted**');
      },
    );

    it.each`
      username
      ${'abcdefghijklmno'}
      ${'s3cr3t'}
      ${'ab'}
    `(
      'leaves a URL with the short lone username $username unchanged',
      ({ username }) => {
        const url = `https://${username}@reg.example.com`;

        expect(detach(url)).toBe(url);
        expect(findNpm('https://reg.example.com/pkg')).toEqual({});
        expect(sanitize(username)).toBe(username);
      },
    );

    it.each`
      password                  | expected
      ${'abcdefghijklmnopqrst'} | ${'**redacted**/foo'}
      ${'abcdefghijklmnop'}     | ${'**redacted**/foo'}
      ${'abcdefghijklmno'}      | ${'abcdefghijklmno/foo'}
      ${'renovate'}             | ${'renovate/foo'}
    `(
      'moves the password $password into a host rule and sanitizes it as $expected',
      ({ password, expected }) => {
        expect(detach(`https://renovate:${password}@pypi.corp/simple`)).toBe(
          'https://pypi.corp/simple',
        );
        expect(findNpm('https://pypi.corp/simple/pkg')).toMatchObject({
          username: 'renovate',
          password,
        });
        expect(sanitize(`${password}/foo`)).toBe(expected);
      },
    );

    it('sanitizes the Basic auth value of credentials from a URL', () => {
      detach('https://renovate:renovate@pypi.corp/simple');

      expect(sanitize('Basic cmVub3ZhdGU6cmVub3ZhdGU=')).toBe(
        'Basic **redacted**',
      );
    });

    it('does not sanitize a short Basic auth value of credentials from a URL', () => {
      detach('https://a:b@pypi.corp/simple');

      expect(findNpm('https://pypi.corp/simple/pkg')).toMatchObject({
        username: 'a',
        password: 'b',
      });
      expect(sanitize('YTpi')).toBe('YTpi');
    });

    it.each`
      url
      ${'https://myorg@pkgs.dev.azure.com/myorg/_packaging/feed/nuget/v3/index.json'}
      ${'https://MyOrg@pkgs.dev.azure.com/myorg/_packaging/feed/nuget/v3/index.json'}
    `(
      'leaves $url with a username equal to its first path segment unchanged',
      ({ url }) => {
        expect(detach(url)).toBe(url);
        expect(findNpm(url)).toEqual({});
        expect(getDetachedCredentialsHash(url)).toBeNull();
        expect(sanitize('myorg')).toBe('myorg');
      },
    );

    it('registers credentials once per host type and keeps the first ones', () => {
      detach('https://user:pass@reg.example.com');
      detach('https://user:pass@reg.example.com');
      detach('https://user:other@reg.example.com');
      detachUrlCredentials('https://user:third@reg.example.com', [
        'npm',
        'maven',
      ]);

      expect(findNpm('https://reg.example.com/pkg')).toMatchObject({
        username: 'user',
        password: 'pass',
      });
      expect(
        find({ hostType: 'maven', url: 'https://reg.example.com/pkg' }),
      ).toMatchObject({ username: 'user', password: 'third' });
    });

    it('leaves the credentials of a configured host rule in place', () => {
      add(
        { matchHost: 'reg.example.com', username: 'svc', password: 'real' },
        { trusted: true },
      );
      add({ matchHost: 'token.example.com', token: 'abc' }, { trusted: true });

      expect(detach('https://user:pass@reg.example.com/simple/')).toBe(
        'https://reg.example.com/simple/',
      );
      expect(detach('https://user:pass@token.example.com/')).toBe(
        'https://token.example.com/',
      );

      expect(findNpm('https://reg.example.com/simple/pkg')).toMatchObject({
        username: 'svc',
        password: 'real',
      });
      expect(findNpm('https://token.example.com/pkg')).toMatchObject({
        token: 'abc',
      });
      expect(findNpm('https://token.example.com/pkg').password).toBeUndefined();
    });

    it.each`
      userinfo                                      | secret                                        | expected
      ${'user:abcdefghijklmnopqrst'}                | ${'abcdefghijklmnopqrst'}                     | ${'**redacted**'}
      ${'user:s3cr3t'}                              | ${'s3cr3t'}                                   | ${'s3cr3t'}
      ${'renovate:renovate'}                        | ${'renovate'}                                 | ${'renovate'}
      ${'ghp_abcdefghijklmnopqrstuvwxyz0123456789'} | ${'ghp_abcdefghijklmnopqrstuvwxyz0123456789'} | ${'**redacted**'}
      ${'s3cr3t'}                                   | ${'s3cr3t'}                                   | ${'s3cr3t'}
      ${'renovate'}                                 | ${'renovate'}                                 | ${'renovate'}
      ${'user:ab'}                                  | ${'ab'}                                       | ${'ab'}
    `(
      'sanitizes $secret of $userinfo next to a configured host rule as $expected',
      ({ userinfo, secret, expected }) => {
        add(
          { matchHost: 'reg.example.com', username: 'svc', password: 'real' },
          { trusted: true },
        );

        detach(`https://${userinfo}@reg.example.com/`);

        expect(findNpm('https://reg.example.com/pkg')).toMatchObject({
          username: 'svc',
          password: 'real',
        });
        expect(
          getDetachedCredentialsHash('https://reg.example.com/'),
        ).toBeNull();
        expect(sanitize(secret)).toBe(expected);
      },
    );

    it.each`
      hostType
      ${'npm'}
      ${'gitlab'}
    `(
      'registers credentials next to a $hostType rule for the host which is not used for the host type',
      ({ hostType }) => {
        add(
          { hostType, matchHost: 'gitlab.example.com', token: 'admin' },
          { trusted: true },
        );

        expect(
          detachUrlCredentials('https://user:pass@gitlab.example.com/maven', [
            'maven',
          ]),
        ).toBe('https://gitlab.example.com/maven');

        expect(
          find({
            hostType: 'maven',
            url: 'https://gitlab.example.com/maven/pkg',
          }),
        ).toMatchObject({ username: 'user', password: 'pass' });
        const configured = find({
          hostType,
          url: 'https://gitlab.example.com/maven/pkg',
        });
        expect(configured.token).toBe('admin');
        expect(configured.username).toBeUndefined();
        expect(configured.password).toBeUndefined();
      },
    );

    it('leaves the credentials of a read-only rule of another hostType for the host in place', () => {
      add(
        {
          matchHost: 'https://pkgs.example.com/',
          hostType: 'npm',
          readOnly: true,
          token: 'ADMIN',
        },
        { trusted: true },
      );

      expect(
        detachUrlCredentials(
          'https://u:p4ssw0rd1234567890@pkgs.example.com/pypi/simple',
          ['pypi'],
        ),
      ).toBe('https://pkgs.example.com/pypi/simple');

      expect(
        getDetachedCredentialsHash('https://pkgs.example.com/pypi/simple'),
      ).toBeNull();
      const pypi = find({
        hostType: 'pypi',
        url: 'https://pkgs.example.com/pypi/simple/pkg/',
        readOnly: true,
      });
      expect(pypi.token).toBe('ADMIN');
      expect(pypi.username).toBeUndefined();
      expect(sanitize('p4ssw0rd1234567890')).toBe('**redacted**');
    });

    it('registers credentials next to a rule for other requests than read-only ones', () => {
      add(
        {
          matchHost: 'https://pkgs.example.com/',
          hostType: 'npm',
          readOnly: false,
          token: 'ADMIN',
        },
        { trusted: true },
      );

      detachUrlCredentials(
        'https://u:p4ssw0rd1234567890@pkgs.example.com/pypi/simple',
        ['pypi'],
      );

      expect(
        find({
          hostType: 'pypi',
          url: 'https://pkgs.example.com/pypi/simple/pkg/',
          readOnly: true,
        }),
      ).toMatchObject({ username: 'u', password: 'p4ssw0rd1234567890' });
    });

    it('registers credentials of a feed next to the platform rule for its host', () => {
      add(
        { hostType: 'azure', matchHost: 'dev.azure.com', token: 'admin' },
        { trusted: true },
      );

      expect(
        detachUrlCredentials(
          'https://user:abcdefghijklmnopqrst@pkgs.dev.azure.com/org/_packaging/feed/pypi/simple/',
          ['pypi'],
        ),
      ).toBe('https://pkgs.dev.azure.com/org/_packaging/feed/pypi/simple/');

      expect(
        find({
          hostType: 'pypi',
          url: 'https://pkgs.dev.azure.com/org/_packaging/feed/pypi/simple/pkg/',
        }),
      ).toMatchObject({ username: 'user', password: 'abcdefghijklmnopqrst' });
      expect(
        find({ hostType: 'azure', url: 'https://dev.azure.com/org/_apis' }),
      ).toMatchObject({ token: 'admin' });
    });

    it('leaves the credentials of a platform rule for the host in place for a host type falling back to it', () => {
      add(
        { hostType: 'gitlab', matchHost: 'gitlab.example.com', token: 'admin' },
        { trusted: true },
      );

      expect(
        detachUrlCredentials('https://user:pass@gitlab.example.com/org/repo', [
          'gitlab-tags',
        ]),
      ).toBe('https://gitlab.example.com/org/repo');

      expect(
        find({
          hostType: 'gitlab-tags',
          url: 'https://gitlab.example.com/org/repo',
        }),
      ).toEqual({});
      expect(
        getDetachedCredentialsHash('https://gitlab.example.com/org/repo'),
      ).toBeNull();
    });

    it('leaves the credentials of a rule scoped by neither hostType nor host in place', () => {
      add({ token: 'admin' }, { trusted: true });

      detach('https://user:pass@reg.example.com');

      expect(findNpm('https://reg.example.com/pkg')).toEqual({
        token: 'admin',
      });
    });

    it('leaves the credentials of a rule without matchHost for one of the host types in place', () => {
      add({ hostType: 'maven', token: 'admin' }, { trusted: true });

      expect(
        detachUrlCredentials('https://user:pass@reg.example.com/maven', [
          'gradle',
          'maven',
        ]),
      ).toBe('https://reg.example.com/maven');

      expect(
        find({ hostType: 'maven', url: 'https://reg.example.com/maven/pkg' }),
      ).toEqual({ token: 'admin' });
      expect(
        find({ hostType: 'gradle', url: 'https://reg.example.com/maven/pkg' }),
      ).toMatchObject({ username: 'user', password: 'pass' });
    });

    it('registers credentials next to a rule without matchHost for other host types', () => {
      add({ hostType: 'maven', token: 'admin' }, { trusted: true });

      detachUrlCredentials('https://user:pass@reg.example.com/pypi', ['pypi']);

      expect(
        find({ hostType: 'pypi', url: 'https://reg.example.com/pypi/pkg' }),
      ).toMatchObject({ username: 'user', password: 'pass' });
    });

    it('registers credentials next to rules which supply none for the host', () => {
      add({ hostType: 'npm', token: 'admin' }, { trusted: true });
      add({ matchHost: 'reg.example.com', timeout: 1000 }, { trusted: true });
      add(
        { matchHost: 'other.example.com', token: 'other' },
        { trusted: true },
      );

      detachUrlCredentials('https://user:pass@reg.example.com', ['maven']);

      expect(
        find({ hostType: 'maven', url: 'https://reg.example.com/pkg' }),
      ).toMatchObject({ username: 'user', password: 'pass', timeout: 1000 });
      expect(findNpm('https://reg.example.com/pkg')).toMatchObject({
        token: 'admin',
      });
      expect(findNpm('https://reg.example.com/pkg').password).toBeUndefined();
    });

    it('moves the credentials of a sparse registry URL into a host rule for its https URL', () => {
      expect(
        detachUrlCredentials(
          'sparse+https://user:pass1234567890123@crates.example.com/index/',
          ['crate'],
        ),
      ).toBe('sparse+https://crates.example.com/index/');

      expect(
        find({
          hostType: 'crate',
          url: 'https://crates.example.com/index/config.json',
        }),
      ).toMatchObject({ username: 'user', password: 'pass1234567890123' });
      const hash = getDetachedCredentialsHash(
        'https://crates.example.com/index/config.json',
      );
      expect(hash).not.toBeNull();
      expect(
        getDetachedCredentialsHash(
          'sparse+https://crates.example.com/index:pkg',
        ),
      ).toBe(hash);
      expect(sanitize('pass1234567890123')).toBe('**redacted**');
    });

    it.each`
      url
      ${'sparse+https://crates.example.com/index/'}
      ${'sparse+git://user:pass1234567890123@crates.example.com/index'}
    `(
      'leaves the sparse registry URL $url without credentials alone',
      ({ url }) => {
        expect(detachUrlCredentials(url, ['crate'])).toBe(url);
        expect(hasDetachedCredentials()).toBeFalse();
      },
    );

    it('removes only the userinfo from the URL', () => {
      expect(detach('https://user:p@ss@Reg.Example.com:8443/a/../b?q')).toBe(
        'https://Reg.Example.com:8443/a/../b?q',
      );
    });

    it.each`
      url                                         | expected
      ${' https://user:pass@reg.example.com/npm'} | ${'https://reg.example.com/npm'}
      ${'https:user:pass@reg.example.com/npm'}    | ${'https://reg.example.com/npm'}
      ${'https://user:pass@evil.com\\@good.com'}  | ${'https://evil.com/@good.com'}
    `(
      'removes the userinfo of $url as the URL parser reads it',
      ({ url, expected }) => {
        expect(detach(url)).toBe(expected);
        expect(findNpm(expected)).toMatchObject({
          username: 'user',
          password: 'pass',
        });
      },
    );
  });

  describe('usesGithubUrlFallback()', () => {
    it.each`
      url                                        | platform    | endpoint                             | expected
      ${'https://api.github.com/repos/org/repo'} | ${'gitlab'} | ${undefined}                         | ${true}
      ${'https://ghe.example.com/api/v3/repos'}  | ${'github'} | ${'https://ghe.example.com/api/v3/'} | ${true}
      ${'https://ghe.example.com/_registry/x'}   | ${'github'} | ${'https://ghe.example.com/api/v3/'} | ${true}
      ${'https://other.example.com/_registry/x'} | ${'github'} | ${'https://ghe.example.com/api/v3/'} | ${false}
      ${'not a url'}                             | ${'github'} | ${'https://ghe.example.com/api/v3/'} | ${false}
      ${'https://ghe.example.com/_registry/x'}   | ${'gitlab'} | ${'https://ghe.example.com/api/v3/'} | ${false}
      ${'https://ghe.example.com/_registry/x'}   | ${'github'} | ${undefined}                         | ${false}
    `(
      'returns $expected for $url with platform $platform and endpoint $endpoint',
      ({ url, platform, endpoint, expected }) => {
        GlobalConfig.set({ platform, endpoint });

        expect(usesGithubUrlFallback(url)).toBe(expected);
      },
    );

    it('leaves the credentials of a github rule on the host of the GitHub platform endpoint in place', () => {
      GlobalConfig.set({
        platform: 'github',
        endpoint: 'https://ghe.example.com/api/v3/',
      });
      add(
        { hostType: 'github', matchHost: 'ghe.example.com', token: 'platform' },
        { trusted: true },
      );

      expect(
        detachUrlCredentials(
          'https://user:pat1234567890123@ghe.example.com/_registry/maven/org/repo',
          ['maven'],
        ),
      ).toBe('https://ghe.example.com/_registry/maven/org/repo');

      expect(
        getDetachedCredentialsHash(
          'https://ghe.example.com/_registry/maven/org/repo',
        ),
      ).toBeNull();
      const maven = find({
        hostType: 'maven',
        url: 'https://ghe.example.com/_registry/maven/org/repo/pkg',
      });
      expect(maven.username).toBeUndefined();
      expect(maven.password).toBeUndefined();
      expect(
        find({
          hostType: 'github',
          url: 'https://ghe.example.com/_registry/maven/org/repo/pkg',
        }),
      ).toMatchObject({ token: 'platform' });
      expect(sanitize('pat1234567890123')).toBe('**redacted**');
    });
  });

  describe('findDetachedCredentials()', () => {
    it('returns the detached credentials of the longest matching path for the host type', () => {
      add(
        { hostType: 'crate', matchHost: 'other.example.com', token: 'abc' },
        { trusted: true },
      );
      detachUrlCredentials('https://outer:outerpass@git.example.com', [
        'crate',
      ]);
      detachUrlCredentials('https://inner:innerpass@git.example.com/org', [
        'crate',
      ]);

      expect(
        findDetachedCredentials({
          hostType: 'crate',
          url: 'https://git.example.com/org/index.git',
        }),
      ).toEqual({ username: 'inner', password: 'innerpass' });
      expect(
        findDetachedCredentials({
          hostType: 'crate',
          url: 'https://git.example.com/index.git',
        }),
      ).toEqual({ username: 'outer', password: 'outerpass' });
      expect(
        findDetachedCredentials({
          hostType: 'npm',
          url: 'https://git.example.com/index.git',
        }),
      ).toBeNull();
      expect(
        findDetachedCredentials({
          hostType: 'crate',
          url: 'https://other.example.com/index.git',
        }),
      ).toBeNull();
    });
  });

  describe('hasDetachedCredentials()', () => {
    it('returns whether credentials were detached', () => {
      add({ matchHost: 'other.example.com', token: 'abc' }, { trusted: true });
      detach('https://reg.example.com/npm');

      expect(hasDetachedCredentials()).toBeFalse();

      detach('https://user:pass@reg.example.com/npm');

      expect(hasDetachedCredentials()).toBeTrue();

      clear();

      expect(hasDetachedCredentials()).toBeFalse();
    });
  });

  describe('getDetachedCredentialsHash()', () => {
    it('returns a hash of the detached credentials matching the URL', () => {
      detach('https://user:first@reg.example.com/npm/');
      const first = getDetachedCredentialsHash('https://reg.example.com/npm/');
      clear();
      detach('https://user:second@reg.example.com/npm/');
      const second = getDetachedCredentialsHash('https://reg.example.com/npm/');

      expect(first).toMatch(/^[\da-f]{64}$/);
      expect(second).toMatch(/^[\da-f]{64}$/);
      expect(first).not.toBe(second);
    });

    it('returns the same hash whatever host type the credentials were detached for', () => {
      detach('https://user:pass@reg.example.com/npm/');
      const npm = getDetachedCredentialsHash('https://reg.example.com/npm/');
      clear();
      detachUrlCredentials('https://user:pass@reg.example.com/npm/', ['maven']);

      expect(npm).not.toBeNull();
      expect(getDetachedCredentialsHash('https://reg.example.com/npm/')).toBe(
        npm,
      );
    });

    it('keeps the hash when the same credentials are detached again for another host type', () => {
      detach('https://user:pass@reg.example.com/npm/');
      const before = getDetachedCredentialsHash('https://reg.example.com/npm/');

      detachUrlCredentials('https://user:pass@reg.example.com/npm', ['maven']);

      expect(before).not.toBeNull();
      expect(getDetachedCredentialsHash('https://reg.example.com/npm/')).toBe(
        before,
      );
      expect(
        find({ hostType: 'maven', url: 'https://reg.example.com/npm/pkg' }),
      ).toMatchObject({ username: 'user', password: 'pass' });
    });

    it('changes the hash when other credentials are detached for another host type', () => {
      detach('https://user:pass@reg.example.com/npm/');
      const before = getDetachedCredentialsHash('https://reg.example.com/npm/');

      detachUrlCredentials('https://user:other@reg.example.com/npm', ['maven']);

      expect(
        getDetachedCredentialsHash('https://reg.example.com/npm/'),
      ).not.toBe(before);
    });

    it.each`
      text
      ${'https://reg.example.com/npm'}
      ${'https://reg.example.com/npm/'}
      ${'https://reg.example.com/npm/pkg'}
      ${'https://reg.example.com/npm:pkg'}
      ${'https://reg.example.com/npm?page=2'}
      ${'https://reg.example.com/npm#top'}
      ${'https://reg.example.com/npm,https://other.example.com'}
      ${'https://reg.example.com/npm other'}
    `('returns the hash for the URL at the start of $text', ({ text }) => {
      detach('https://user:pass@reg.example.com/npm/');

      expect(getDetachedCredentialsHash(text)).toBe(
        getDetachedCredentialsHash('https://reg.example.com/npm'),
      );
      expect(getDetachedCredentialsHash(text)).not.toBeNull();
    });

    it.each`
      text
      ${'https://reg.example.com/'}
      ${'https://reg.example.com/npm2'}
      ${'https://reg.example.com/other/npm'}
      ${'https://other.example.com/npm'}
      ${'getReleases:https://reg.example.com/npm'}
    `('returns null for $text', ({ text }) => {
      detach('https://user:pass@reg.example.com/npm/');

      expect(getDetachedCredentialsHash(text)).toBeNull();
    });

    it.each`
      url                                             | text
      ${'https://user:pass@Reg.Example.com/npm'}      | ${'https://reg.example.com/npm:pkg'}
      ${'https://user:pass@reg.example.com:443/npm'}  | ${'https://reg.example.com/npm:pkg'}
      ${'https://user:pass@reg.example.com/a/../npm'} | ${'https://reg.example.com/npm:pkg'}
      ${'https://user:pass@reg.example.com/npm'}      | ${'https://Reg.Example.com/npm:pkg'}
      ${'https://user:pass@reg.example.com/npm'}      | ${'HTTPS://reg.example.com:443/npm/?page=2'}
      ${'https://user:pass@reg.example.com/npm'}      | ${'https://reg.example.com/a/../npm/pkg'}
      ${'https://user:pass@Reg.Example.com'}          | ${'https://Reg.Example.com:pkg'}
      ${'https://user:pass@Reg.Example.com:8443'}     | ${'https://Reg.Example.com:8443/pkg'}
      ${'https://user:pass@reg.example.com/npm'}      | ${'https://reg.example.com/npm,https://other.example.com'}
    `('returns the hash of $url for $text', ({ url, text }) => {
      detach(url);

      expect(getDetachedCredentialsHash(text)).not.toBeNull();
    });

    it.each`
      text
      ${'https://user@reg.example.com/npm:pkg'}
      ${'https://user:pass@reg.example.com/npm'}
      ${'https://:pass@Reg.Example.com/npm/pkg'}
      ${'https://u@s@reg.example.com:443/npm?page=2'}
    `(
      'returns the hash for the URL with its own userinfo $text',
      ({ text }) => {
        detach('https://user:pass@reg.example.com/npm');

        expect(getDetachedCredentialsHash(text)).toBe(
          getDetachedCredentialsHash('https://reg.example.com/npm'),
        );
        expect(getDetachedCredentialsHash(text)).not.toBeNull();
      },
    );

    it.each`
      text
      ${'https://user@other.example.com/npm'}
      ${'https://user@reg.example.com/npm2'}
      ${'s3://reg.example.com/npm'}
      ${'https://Reg.Example.com/npm2'}
      ${'https://reg.example.com:8443/npm'}
    `('returns null for the other URL $text', ({ text }) => {
      detach('https://user:pass@reg.example.com/npm');

      expect(getDetachedCredentialsHash(text)).toBeNull();
    });

    it('returns the hash for the origin of credentials of the root path', () => {
      detach('https://user:pass@reg.example.com');

      expect(
        getDetachedCredentialsHash('https://reg.example.com:library/node'),
      ).not.toBeNull();
      expect(
        getDetachedCredentialsHash('https://reg.example.com:@types/node'),
      ).not.toBeNull();
      expect(
        getDetachedCredentialsHash('https://reg.example.com.other.com/'),
      ).toBeNull();
    });

    it('ignores host rules not registered from URL credentials', () => {
      add({ matchHost: 'reg.example.com', token: 'admin' }, { trusted: true });
      add({ matchHost: 'https://other.example.com', password: 'repo' });

      detach('https://user:pass@reg.example.com/');

      expect(getDetachedCredentialsHash('https://reg.example.com/')).toBeNull();
      expect(
        getDetachedCredentialsHash('https://other.example.com/'),
      ).toBeNull();
    });

    it('returns null after clear()', () => {
      detach('https://user:pass@reg.example.com/');

      clear();

      expect(getDetachedCredentialsHash('https://reg.example.com/')).toBeNull();
    });
  });

  describe('matchesHost()', () => {
    it.each`
      url                                  | prefixOnly | expected
      ${'https://reg.example.com/npm/pkg'} | ${false}   | ${true}
      ${'https://reg.example.com/npm/pkg'} | ${true}    | ${true}
      ${'https://reg.example.com/npm'}     | ${false}   | ${true}
      ${'https://reg.example.com/npm'}     | ${true}    | ${false}
      ${'https://reg.example.com/npm2'}    | ${false}   | ${false}
    `(
      'returns $expected for $url with prefixOnly $prefixOnly',
      ({ url, prefixOnly, expected }) => {
        expect(
          matchesHost(url, 'https://reg.example.com/npm/', { prefixOnly }),
        ).toBe(expected);
      },
    );
  });

  describe('filterAllowedHeaders()', () => {
    it('leaves rules without headers untouched', () => {
      const rules = [{ matchHost: 'registry.example.com' }];

      expect(filterAllowedHeaders(rules)).toEqual(rules);
      expect(logger.logger.warn).not.toHaveBeenCalled();
    });

    it('keeps headers matching allowedHeaders and drops the rest with a warning', () => {
      expect(
        filterAllowedHeaders([
          {
            matchHost: 'registry.example.com',
            headers: { 'X-Allowed': 'yes', Authorization: 'Bearer secret' },
          },
        ]),
      ).toEqual([
        {
          matchHost: 'registry.example.com',
          headers: { 'X-Allowed': 'yes' },
        },
      ]);
      expect(logger.logger.warn).toHaveBeenCalledWith(
        { denied: ['Authorization'] },
        "Ignoring hostRules headers not permitted by this Renovate instance's `allowedHeaders`",
      );
    });

    it('leaves everything but the headers untouched', () => {
      const rules = [
        {
          matchHost: 'registry.example.com',
          hostType: 'npm',
          username: 'user',
          password: 'pass',
          token: 'token',
          headers: { 'X-Allowed': 'yes' },
        },
      ];

      expect(filterAllowedHeaders(rules)).toEqual(rules);
      expect(logger.logger.warn).not.toHaveBeenCalled();
    });

    it('drops a header the self-hosted admin supplied themselves', () => {
      // `allowedHeaders` enforces the checks regardless of whether it's global self-hosted administrator config, or repo config
      GlobalConfig.reset();

      expect(
        filterAllowedHeaders([
          {
            matchHost: 'registry.example.com',
            headers: { Authorization: 'set-by-admin' },
          },
        ]),
        // `headers` is dropped rather than left empty, so that the rule does not go on to suppress the headers of the broader rules it is combined with
      ).toEqual([{ matchHost: 'registry.example.com' }]);
      expect(logger.logger.warn).toHaveBeenCalledWith(
        { denied: ['Authorization'] },
        "Ignoring hostRules headers not permitted by this Renovate instance's `allowedHeaders`",
      );
    });
  });

  describe('find()', () => {
    beforeEach(() => {
      clear();
    });

    it('warns and returns empty for bad search', () => {
      // oxlint-disable-next-line renovate/prefer-partial-in-specs -- intentionally invalid search input
      expect(find({ abc: 'def' } as any)).toEqual({});
    });

    it('returns a truly empty object for no match, not one with an undefined trustedHeaderNames', () => {
      // `toEqual({})` alone would not catch this: it ignores `undefined`-valued properties, but callers elsewhere use `Object.keys(...).length`/`isNonEmptyObject` to detect an empty result
      add(
        {
          matchHost: 'registry.example.com',
          headers: { 'X-From-Admin': 'yes' },
        },
        { trusted: true },
      );

      expect(
        Object.keys(find({ url: 'https://unrelated.example.com' })),
      ).toEqual([]);
    });

    it('needs exact host matches', () => {
      add(
        partial<LegacyHostRule & HostRule>({
          hostType: NugetDatasource.id,
          hostName: 'nuget.org',
          username: 'root',
          password: 'p4$$w0rd',
          token: undefined,
        }),
      );
      expect(find({ hostType: NugetDatasource.id })).toEqual({});
      expect(
        find({ hostType: NugetDatasource.id, url: 'https://nuget.org' }),
      ).not.toEqual({});
      expect(
        find({ hostType: NugetDatasource.id, url: 'https://not.nuget.org' }),
      ).not.toEqual({});
      expect(
        find({ hostType: NugetDatasource.id, url: 'https://not-nuget.org' }),
      ).toEqual({});
    });

    it('matches on empty rules', () => {
      add({
        enabled: true,
      });
      expect(
        find({ hostType: NugetDatasource.id, url: 'https://api.github.com' }),
      ).toEqual({ enabled: true });
    });

    it('matches on hostType', () => {
      add({
        hostType: NugetDatasource.id,
        token: 'abc',
      });
      expect(
        find({ hostType: NugetDatasource.id, url: 'https://nuget.local/api' }),
      ).toEqual({ token: 'abc' });
    });

    it('matches on domainName', () => {
      add(
        partial<LegacyHostRule & HostRule>({
          domainName: 'github.com',
          token: 'def',
        }),
      );
      expect(
        find({ hostType: NugetDatasource.id, url: 'https://api.github.com' })
          .token,
      ).toBe('def');
      expect(
        find({ hostType: NugetDatasource.id, url: 'https://github.com' }).token,
      ).toBe('def');
      expect(
        find({ hostType: NugetDatasource.id, url: 'https://apigithub.com' })
          .token,
      ).toBeUndefined();
    });

    it('matches on specific path', () => {
      // Initialized platform host rule
      add({
        hostType: 'github',
        matchHost: 'https://api.github.com',
        token: 'abc',
      });
      // specific host rule for using other token in different org
      add({
        hostType: 'github',
        matchHost: 'https://api.github.com/repos/org-b/',
        token: 'def',
      });
      // Initialized generic host rule for github platform
      add({
        hostType: 'github',
        matchHost: 'https://api.github.com',
        token: 'abc',
      });
      expect(
        find({
          hostType: 'github',
          url: 'https://api.github.com/repos/org-b/someRepo/tags?per_page=100',
        }).token,
      ).toBe('def');
    });

    it('matches for several hostTypes when no hostType rule is configured', () => {
      add({
        matchHost: 'https://api.github.com',
        token: 'abc',
      });
      expect(
        find({
          hostType: 'github',
          url: 'https://api.github.com/repos/org-b/someRepo/tags?per_page=100',
        }).token,
      ).toBe('abc');
      expect(
        find({
          hostType: 'github-releases',
          url: 'https://api.github.com/repos/org-b/someRepo/tags?per_page=100',
        }).token,
      ).toBe('abc');
    });

    it('matches if hostType is configured and host rule is filtered with datasource', () => {
      add({
        hostType: 'github',
        matchHost: 'https://api.github.com',
        token: 'abc',
      });
      add({
        hostType: 'github-tags',
        matchHost: 'https://api.github.com/repos/org-b/',
        token: 'def',
      });
      expect(
        find({
          hostType: 'github-tags',
          url: 'https://api.github.com/repos/org-b/someRepo/tags?per_page=100',
        }).token,
      ).toBe('def');
    });

    it('matches on hostName', () => {
      add(
        partial<LegacyHostRule & HostRule>({
          hostName: 'nuget.local',
          token: 'abc',
        }),
      );
      expect(
        find({ hostType: NugetDatasource.id, url: 'https://nuget.local/api' }),
      ).toEqual({ token: 'abc' });
    });

    it('matches on matchHost with protocol', () => {
      add({
        matchHost: 'https://domain.com',
        token: 'def',
      });
      expect(find({ url: 'https://api.domain.com' }).token).toBeUndefined();
      expect(find({ url: 'https://domain.com' }).token).toBe('def');
      expect(
        find({
          hostType: NugetDatasource.id,
          url: 'https://domain.com/renovatebot',
        }).token,
      ).toBe('def');
    });

    it('matches on matchHost without protocol', () => {
      add({
        matchHost: 'domain.com',
        token: 'def',
      });
      expect(find({ url: 'https://api.domain.com' }).token).toBe('def');
      expect(find({ url: 'https://domain.com' }).token).toBe('def');
      expect(find({ url: 'httpsdomain.com' }).token).toBeUndefined();
    });

    it('matches on matchHost with dot prefix', () => {
      add({
        matchHost: '.domain.com',
        token: 'def',
      });
      expect(find({ url: 'https://api.domain.com' }).token).toBe('def');
      expect(find({ url: 'https://domain.com' }).token).toBeUndefined();
      expect(find({ url: 'httpsdomain.com' }).token).toBeUndefined();
    });

    it('matches on matchHost with port', () => {
      add({
        matchHost: 'https://domain.com:9118',
        token: 'def',
      });
      expect(find({ url: 'https://domain.com:9118' }).token).toBe('def');
      expect(find({ url: 'https://domain.com' }).token).toBeUndefined();
      expect(find({ url: 'httpsdomain.com' }).token).toBeUndefined();
    });

    it('matches a URL carrying user:pass@ against a matchHost without credentials', () => {
      add({
        matchHost: 'https://domain.com',
        token: 'def',
      });
      expect(find({ url: 'https://user:pass@domain.com' }).token).toBe('def');
    });

    it('matches a URL carrying user:pass@ against a path-scoped matchHost', () => {
      add({
        matchHost: 'https://domain.com/simple/',
        token: 'def',
      });
      expect(find({ url: 'https://user:pass@domain.com/simple/' }).token).toBe(
        'def',
      );
      expect(
        find({ url: 'https://user:pass@domain.com/other/' }).token,
      ).toBeUndefined();
    });

    it('matches the path of a matchHost ending with a slash without the slash', () => {
      add({ matchHost: 'https://domain.com/simple/', token: 'def' });

      expect(find({ url: 'https://domain.com/simple' }).token).toBe('def');
      expect(find({ url: 'https://domain.com/simple?page=2' }).token).toBe(
        'def',
      );
      expect(find({ url: 'https://domain.com/simple2' }).token).toBeUndefined();
    });

    it('matches on hostType and endpoint', () => {
      add({
        hostType: NugetDatasource.id,
        matchHost: 'https://nuget.local/api',
        token: 'abc',
      });
      expect(
        find({ hostType: NugetDatasource.id, url: 'https://nuget.local/api' })
          .token,
      ).toBe('abc');
    });

    it('matches on endpoint subresource', () => {
      add({
        hostType: NugetDatasource.id,
        matchHost: 'https://nuget.local/api',
        token: 'abc',
      });
      expect(
        find({
          hostType: NugetDatasource.id,
          url: 'https://nuget.local/api/sub-resource',
        }),
      ).toEqual({ token: 'abc' });
    });

    it('matches shortest matchHost first', () => {
      add({
        matchHost: 'https://nuget.local/api',
        token: 'longest',
      });
      add({
        matchHost: 'https://nuget.local/',
        token: 'shortest',
      });
      expect(
        find({
          url: 'https://nuget.local/api/sub-resource',
        }),
      ).toEqual({ token: 'longest' });
    });

    it('combines the headers of a trusted and an untrusted matching rule', () => {
      // when setting `headers` in global self-hosted configuration and a repo, `find()` should combine the headers,
      add(
        {
          matchHost: 'registry.example.com',
          token: 'from-admin',
          headers: { 'X-From-Admin': 'yes' },
        },
        { trusted: true },
      );
      add({
        matchHost: 'registry.example.com',
        headers: { 'X-From-Repo': 'yes' },
      });

      expect(find({ url: 'https://registry.example.com' })).toEqual({
        token: 'from-admin',
        headers: { 'X-From-Admin': 'yes', 'X-From-Repo': 'yes' },
        internalHostGrant: { implicit: true },
        trustedHeaderNames: ['X-From-Admin'],
      });
    });

    it('prefers a trusted rule for a header an untrusted rule also sets', () => {
      // a repository must not be able to substitute the value the admin set, even with a more specific rule
      add(
        {
          matchHost: 'registry.example.com',
          headers: { 'X-Custom': 'from-admin' },
        },
        { trusted: true },
      );
      add({
        matchHost: 'https://registry.example.com/some/path',
        headers: { 'X-Custom': 'from-repo' },
      });

      expect(
        find({ url: 'https://registry.example.com/some/path/resource' }),
      ).toEqual({
        headers: { 'X-Custom': 'from-admin' },
        internalHostGrant: { implicit: true },
        trustedHeaderNames: ['X-Custom'],
      });
    });

    it('ignores a `trusted` smuggled in through the rule itself', () => {
      add({
        matchHost: 'registry.example.com',
        headers: { 'X-Custom': 'from-admin' },
      });
      // `trusted` is not a `HostRule` field, but config is parsed from JSON, so a repository can still put one there
      const smuggled: HostRule = {
        matchHost: 'registry.example.com',
        headers: { 'X-Custom': 'from-repo' },
      };
      add(Object.assign(smuggled, { trusted: true }));

      // both rules are untrusted, so the second masks the first rather than being applied over it
      expect(find({ url: 'https://registry.example.com' })).toEqual({
        headers: { 'X-Custom': 'from-repo' },
        trustedHeaderNames: [],
      });
    });

    it('lets the last matching rule of a tier mask the headers of a broader one', () => {
      // the masking pattern: a broad rule carrying a credential, and a narrower rule that keeps it away from one host
      add(
        {
          matchHost: 'example.com',
          headers: { 'X-Api-Key': 'secret' },
        },
        { trusted: true },
      );
      add(
        {
          matchHost: 'https://untrusted.example.com',
          headers: { 'X-Other': 'yes' },
        },
        { trusted: true },
      );

      expect(find({ url: 'https://untrusted.example.com' })).toEqual({
        headers: { 'X-Other': 'yes' },
        internalHostGrant: { implicit: true },
        trustedHeaderNames: ['X-Other'],
      });
      expect(find({ url: 'https://trusted.example.com' })).toEqual({
        headers: { 'X-Api-Key': 'secret' },
        internalHostGrant: { implicit: true },
        trustedHeaderNames: ['X-Api-Key'],
      });
    });

    it('masks within a tier without affecting the other tier', () => {
      add(
        {
          matchHost: 'example.com',
          headers: { 'X-From-Admin': 'yes' },
        },
        { trusted: true },
      );
      add({
        matchHost: 'example.com',
        headers: { 'X-From-Repo': 'yes' },
      });
      add({
        matchHost: 'https://untrusted.example.com',
        headers: { 'X-Other-Repo-Header': 'yes' },
      });

      // the repo's narrower rule masks its own broader one, but cannot mask the admin's
      expect(find({ url: 'https://untrusted.example.com' })).toEqual({
        headers: { 'X-Other-Repo-Header': 'yes', 'X-From-Admin': 'yes' },
        internalHostGrant: { implicit: true },
        trustedHeaderNames: ['X-From-Admin'],
      });
    });

    it('leaves a header name the admin masked from their own tier to the repository', () => {
      // the admin's narrower rule masks their own broader one, so `X-From-Admin` is not among the headers they send to this host - which leaves the repository's value for that name the only one there is
      add({ headers: { 'X-From-Admin': 'yes' } }, { trusted: true });
      add(
        {
          matchHost: 'https://registry.example.com',
          headers: { 'X-Other-Admin-Header': 'yes' },
        },
        { trusted: true },
      );
      add({
        matchHost: 'https://registry.example.com',
        headers: { 'X-From-Admin': 'from-repo' },
      });

      expect(find({ url: 'https://registry.example.com' })).toEqual({
        headers: { 'X-From-Admin': 'from-repo', 'X-Other-Admin-Header': 'yes' },
        internalHostGrant: { implicit: true },
        trustedHeaderNames: ['X-Other-Admin-Header'],
      });
    });

    it('applies the headers of the three trust tiers in order', () => {
      // the admin's own value must survive both of the tiers below theirs, and inherited config's must survive a repository's
      add(
        {
          matchHost: 'registry.example.com',
          headers: { 'X-Custom': 'from-admin' },
        },
        { trusted: true },
      );
      add(
        {
          matchHost: 'https://registry.example.com/deeper',
          headers: { 'X-Custom': 'from-inherited', 'X-Inherited': 'yes' },
        },
        { inherited: true },
      );
      add({
        matchHost: 'https://registry.example.com/deeper/still',
        headers: {
          'X-Custom': 'from-repo',
          'X-Inherited': 'from-repo',
          'X-Repo': 'yes',
        },
      });

      expect(
        find({ url: 'https://registry.example.com/deeper/still/resource' })
          .headers,
      ).toEqual({
        'X-Custom': 'from-admin',
        'X-Inherited': 'yes',
        'X-Repo': 'yes',
      });
    });

    it('applies inherited headers over a repository rule when the admin sets none', () => {
      add(
        {
          matchHost: 'registry.example.com',
          headers: { 'X-Custom': 'from-inherited' },
        },
        { inherited: true },
      );
      add({
        matchHost: 'https://registry.example.com/deeper',
        headers: { 'X-Custom': 'from-repo' },
      });

      expect(
        find({ url: 'https://registry.example.com/deeper/resource' }).headers,
      ).toEqual({ 'X-Custom': 'from-inherited' });
    });

    it('keeps `trustedHeaderNames` as an explicit key, set to `[]`, when only untrusted headers match', () => {
      // an empty array, not an absent key, so that `findMatchingRule`'s hostType fallbacks - which combine results with `{ ...fallbackResult, ...res }` - have this result's `trustedHeaderNames` override a fallback's own, rather than a plain object spread letting the fallback's value show through underneath an unrelated `res.headers`; see "does not let a fallback hostType's trustedHeaderNames leak onto a rule's own untrusted headers" in `lib/util/http/host-rules.spec.ts` for that merge end-to-end
      add({
        matchHost: 'registry.example.com',
        headers: { 'X-Custom': 'from-repo' },
      });

      expect(find({ url: 'https://registry.example.com' })).toEqual({
        headers: { 'X-Custom': 'from-repo' },
        trustedHeaderNames: [],
      });
    });

    it('does not let a rule whose headers were all denied suppress another rule of its tier', () => {
      GlobalConfig.set({ allowedHeaders: ['X-*'] });
      add({
        matchHost: 'registry.example.com',
        headers: { 'X-Custom': 'yes' },
      });
      add({
        matchHost: 'https://registry.example.com/some/path',
        headers: { Authorization: 'denied' },
      });

      expect(
        find({ url: 'https://registry.example.com/some/path/resource' }),
      ).toEqual({
        headers: { 'X-Custom': 'yes' },
        trustedHeaderNames: [],
      });
    });

    describe('internalHostGrant', () => {
      it('is absent when no trusted rule matches', () => {
        add({ matchHost: 'registry.example.com', token: 'abc' });

        expect(
          find({ url: 'https://registry.example.com' }).internalHostGrant,
        ).toBeUndefined();
      });

      it('is implicit for a host the admin named', () => {
        add(
          { matchHost: 'registry.example.com', token: 'abc' },
          { trusted: true },
        );

        expect(find({ url: 'https://registry.example.com' })).toEqual({
          token: 'abc',
          internalHostGrant: { implicit: true },
        });
      });

      it('is not implicit for a host-less trusted rule', () => {
        add({ hostType: 'nuget', token: 'abc' }, { trusted: true });

        expect(
          find({ hostType: 'nuget', url: 'https://internal.example.com' })
            .internalHostGrant,
        ).toBeUndefined();
      });

      it('ignores allowInternal from untrusted config', () => {
        add({ matchHost: 'internal.example.com', allowInternal: true });

        expect(
          find({ url: 'https://internal.example.com' }).internalHostGrant,
        ).toBeUndefined();
        expect(logger.logger.debug).toHaveBeenCalledWith(
          'Ignoring hostRules allowInternal for internal.example.com from untrusted config',
        );
      });

      it('ignores allowInternal from an untrusted host-less rule', () => {
        add({ hostType: 'nuget', allowInternal: true });

        expect(
          find({ hostType: 'nuget', url: 'https://internal.example.com' })
            .internalHostGrant,
        ).toBeUndefined();
        expect(logger.logger.debug).toHaveBeenCalledWith(
          'Ignoring hostRules allowInternal for nuget from untrusted config',
        );
      });

      it('takes explicit allowInternal from the admin, most specific rule winning', () => {
        add(
          { matchHost: 'example.com', allowInternal: true },
          { trusted: true },
        );
        add(
          { matchHost: 'https://secure.example.com', allowInternal: false },
          { trusted: true },
        );

        expect(
          find({ url: 'https://other.example.com' }).internalHostGrant,
        ).toEqual({ explicit: true, implicit: true });
        expect(
          find({ url: 'https://secure.example.com' }).internalHostGrant,
        ).toEqual({ explicit: false, scoped: false, implicit: false });
      });

      it('marks a grant scoped by hostType', () => {
        add(
          {
            hostType: 'preset',
            matchHost: 'presets.example.com',
            allowInternal: true,
          },
          { trusted: true },
        );

        expect(
          find({ hostType: 'preset', url: 'https://presets.example.com' })
            .internalHostGrant,
        ).toEqual({ explicit: true, scoped: true, implicit: true });
      });

      it('does not mark a bare-hostname grant as scoped', () => {
        add(
          { matchHost: 'internal.example.com', allowInternal: true },
          { trusted: true },
        );

        expect(
          find({ url: 'https://internal.example.com' }).internalHostGrant,
        ).toEqual({ explicit: true, implicit: true });
      });

      it('does not let a repository rule override the admin allowInternal', () => {
        add(
          { matchHost: 'https://internal.example.com', allowInternal: false },
          { trusted: true },
        );
        add({
          matchHost: 'https://internal.example.com/deeper/path',
          allowInternal: true,
        });

        expect(
          find({ url: 'https://internal.example.com/deeper/path/file' })
            .internalHostGrant,
        ).toEqual({ explicit: false, scoped: false, implicit: false });
      });

      it('is implicit for a host named by trusted inherited config', () => {
        add(
          { matchHost: 'registry.example.com', token: 'abc' },
          { inherited: true },
        );

        expect(find({ url: 'https://registry.example.com' })).toEqual({
          token: 'abc',
          internalHostGrant: { implicit: true },
        });
      });

      it('takes explicit allowInternal from trusted inherited config', () => {
        add(
          { matchHost: 'internal.example.com', allowInternal: true },
          { inherited: true },
        );

        expect(
          find({ url: 'https://internal.example.com' }).internalHostGrant,
        ).toEqual({ explicit: true, implicit: true });
      });

      it('marks a grant scoped by trusted inherited config', () => {
        add(
          {
            hostType: 'preset',
            matchHost: 'https://presets.example.com/renovate/',
            allowInternal: true,
          },
          { inherited: true },
        );

        expect(
          find({
            hostType: 'preset',
            url: 'https://presets.example.com/renovate/default',
          }).internalHostGrant,
        ).toEqual({ explicit: true, scoped: true, implicit: true });
      });

      it('does not let inherited config override the admin allowInternal', () => {
        // the admin's decision stands even though the inherited rule out-specifies theirs
        add(
          { matchHost: 'https://internal.example.com', allowInternal: false },
          { trusted: true },
        );
        add(
          {
            hostType: 'preset',
            matchHost: 'https://internal.example.com/deeper/path',
            allowInternal: true,
          },
          { inherited: true },
        );

        expect(
          find({
            hostType: 'preset',
            url: 'https://internal.example.com/deeper/path/file',
          }).internalHostGrant,
        ).toEqual({ explicit: false, scoped: false, implicit: false });
      });

      it('does not let an inherited scoped grant fill in for a bare admin veto', () => {
        // the admin's rule sets no scoped verdict of its own, so a scoped inherited grant must not be the one that answers for it - config-fetching requests consult `scoped` alone
        add(
          { matchHost: 'internal.example.com', allowInternal: false },
          { trusted: true },
        );
        add(
          {
            matchHost: 'https://internal.example.com/presets/',
            allowInternal: true,
          },
          { inherited: true },
        );

        expect(
          find({ url: 'https://internal.example.com/presets/default' })
            .internalHostGrant,
        ).toEqual({ explicit: false, scoped: false, implicit: false });
      });

      it('does not let an inherited bare grant fill in for a scoped admin veto', () => {
        add(
          {
            matchHost: 'https://internal.example.com/presets/',
            allowInternal: false,
          },
          { trusted: true },
        );
        add(
          { matchHost: 'internal.example.com', allowInternal: true },
          { inherited: true },
        );

        expect(
          find({ url: 'https://internal.example.com/presets/default' })
            .internalHostGrant,
        ).toEqual({ explicit: false, scoped: false, implicit: false });
      });

      it('does not leave an implicit grant behind for a host the admin vetoed', () => {
        add(
          { matchHost: 'internal.example.com', allowInternal: false },
          { trusted: true },
        );
        add(
          { matchHost: 'internal.example.com', token: 'abc' },
          { inherited: true },
        );

        expect(
          find({ url: 'https://internal.example.com' }).internalHostGrant,
        ).toEqual({ explicit: false, scoped: false, implicit: false });
      });

      it('lets the admin mask their own allowInternal without vetoing', () => {
        add(
          { matchHost: 'example.com', allowInternal: false },
          { trusted: true },
        );
        add(
          { matchHost: 'https://example.com/ok/', allowInternal: true },
          { trusted: true },
        );

        expect(
          find({ url: 'https://example.com/ok/resource' }).internalHostGrant,
        ).toEqual({ explicit: true, scoped: true, implicit: true });
      });

      it('takes a scoped grant from inherited config when no admin rule matches', () => {
        add(
          {
            matchHost: 'https://internal.example.com/presets/',
            allowInternal: true,
          },
          { inherited: true },
        );

        expect(
          find({ url: 'https://internal.example.com/presets/default' })
            .internalHostGrant,
        ).toEqual({ explicit: true, scoped: true, implicit: true });
      });
    });

    describe('enabled trust tiers', () => {
      it('does not let a more specific repository rule re-enable a host the admin disabled', () => {
        add(
          { matchHost: 'bad.example.com', enabled: false },
          { trusted: true },
        );
        add({ matchHost: 'https://bad.example.com/deeper', enabled: true });

        expect(
          find({ url: 'https://bad.example.com/deeper/path' }).enabled,
        ).toBeFalse();
      });

      it('does not let a repository rule disable a host the admin enabled', () => {
        add(
          { matchHost: 'good.example.com', enabled: true },
          { trusted: true },
        );
        add({ matchHost: 'https://good.example.com/deeper', enabled: false });

        expect(
          find({ url: 'https://good.example.com/deeper/path' }).enabled,
        ).toBeTrue();
      });

      it('keeps repository rules able to disable a host of their own', () => {
        add({ matchHost: 'flaky.example.com', enabled: false });

        expect(find({ url: 'https://flaky.example.com' }).enabled).toBeFalse();
      });

      it('lets the most specific rule of a tier win', () => {
        add({ matchHost: 'example.com', enabled: false });
        add({ matchHost: 'https://ok.example.com', enabled: true });

        expect(find({ url: 'https://ok.example.com' }).enabled).toBeTrue();
      });

      it('does not let inherited config re-enable a host the admin disabled', () => {
        add(
          { matchHost: 'bad.example.com', enabled: false },
          { trusted: true },
        );
        add(
          { matchHost: 'https://bad.example.com/deeper', enabled: true },
          { inherited: true },
        );

        expect(
          find({ url: 'https://bad.example.com/deeper/path' }).enabled,
        ).toBeFalse();
      });

      it('does not let a repository rule re-enable a host inherited config disabled', () => {
        add(
          { matchHost: 'bad.example.com', enabled: false },
          { inherited: true },
        );
        add({ matchHost: 'https://bad.example.com/deeper', enabled: true });

        expect(
          find({ url: 'https://bad.example.com/deeper/path' }).enabled,
        ).toBeFalse();
      });
    });

    it('prefers the longest matchHost for a header they both set', () => {
      add({
        matchHost: 'https://registry.example.com',
        headers: { 'X-Custom': 'shortest', 'X-Only-Shortest': 'yes' },
      });
      add({
        matchHost: 'https://registry.example.com/some/path',
        headers: { 'X-Custom': 'longest' },
      });

      expect(
        find({ url: 'https://registry.example.com/some/path/resource' }),
      ).toEqual({
        headers: { 'X-Custom': 'longest' },
        trustedHeaderNames: [],
      });
    });

    it('prefers the longest matchHost even when a host-less rule is added between them', () => {
      // the sort comparator must stay transitive: a rule with no `matchHost` compares equal to any other, so a naive length sort could leave the two `matchHost` rules unordered relative to each other
      add({
        matchHost: 'https://registry.example.com/some/path',
        headers: { 'X-Custom': 'longest' },
      });
      add({
        hostType: NugetDatasource.id,
        token: 'unrelated',
      });
      add({
        matchHost: 'https://registry.example.com',
        headers: { 'X-Custom': 'shortest' },
      });

      expect(
        find({ url: 'https://registry.example.com/some/path/resource' }),
      ).toEqual({
        headers: { 'X-Custom': 'longest' },
        trustedHeaderNames: [],
      });
    });

    it('prefers a `hostType` rule over one with a longer `matchHost`', () => {
      // "most specific" is ranked before it is measured: a rule carrying both a `hostType` and a `matchHost` outranks a `matchHost`-only rule, however much more of the URL the latter matches
      add({
        matchHost: 'https://registry.example.com/some/path',
        headers: { 'X-Custom': 'from-longer-matchHost' },
      });
      add({
        hostType: NugetDatasource.id,
        matchHost: 'https://registry.example.com',
        headers: { 'X-Custom': 'from-hostType-rule' },
      });

      expect(
        find({
          url: 'https://registry.example.com/some/path/resource',
          hostType: NugetDatasource.id,
        }),
      ).toEqual({
        headers: { 'X-Custom': 'from-hostType-rule' },
        trustedHeaderNames: [],
      });
    });

    it('keeps the headers of an earlier matching rule when a later one sets none', () => {
      add({
        matchHost: 'registry.example.com',
        headers: { 'X-From-Admin': 'yes' },
      });
      add({
        matchHost: 'registry.example.com',
        timeout: 10000,
      });

      expect(find({ url: 'https://registry.example.com' })).toEqual({
        headers: { 'X-From-Admin': 'yes' },
        timeout: 10000,
        trustedHeaderNames: [],
      });
    });

    it('matches readOnly requests', () => {
      add({
        matchHost: 'https://api.github.com/repos/',
        token: 'aaa',
        hostType: 'github',
      });
      add({
        matchHost: 'https://api.github.com',
        token: 'bbb',
        readOnly: true,
      });
      expect(
        find({
          url: 'https://api.github.com/repos/foo/bar/tags',
          readOnly: true,
        }),
      ).toEqual({ token: 'bbb' });
    });
  });

  describe('hosts()', () => {
    it('returns hosts', () => {
      add({
        hostType: NugetDatasource.id,
        token: 'aaaaaa',
      });
      add({
        hostType: NugetDatasource.id,
        matchHost: 'https://nuget.local/api',
        token: 'abc',
      });
      add(
        partial<LegacyHostRule & HostRule>({
          hostType: NugetDatasource.id,
          hostName: 'my.local.registry',
          token: 'def',
        }),
      );
      add({
        hostType: NugetDatasource.id,
        matchHost: 'another.local.registry',
        token: 'xyz',
      });
      add({
        hostType: NugetDatasource.id,
        matchHost: 'https://yet.another.local.registry',
        token: '123',
      });
      const res = hosts({
        hostType: NugetDatasource.id,
      });
      expect(res).toEqual([
        'nuget.local',
        'my.local.registry',
        'another.local.registry',
        'yet.another.local.registry',
      ]);
    });
  });

  describe('findAll()', () => {
    it('warns and returns empty for bad search', () => {
      // oxlint-disable-next-line renovate/prefer-partial-in-specs -- intentionally invalid search input
      expect(findAll({ abc: 'def' } as any)).toEqual([]);
    });

    it('needs exact host matches', () => {
      const hostRule = {
        hostType: 'nuget',
        hostName: 'nuget.org',
        username: 'root',
        password: 'p4$$w0rd',
      };
      add(hostRule);
      expect(findAll({ hostType: 'nuget' })).toEqual([
        {
          hostType: 'nuget',
          password: 'p4$$w0rd',
          resolvedHost: 'nuget.org',
          username: 'root',
          matchHost: 'nuget.org',
          trustTier: 'untrusted',
        },
      ]);
    });
  });

  describe('getAll()', () => {
    it('returns all host rules', () => {
      const hostRule1 = {
        hostType: 'nuget',
        matchHost: 'nuget.org',
        username: 'root',
        password: 'p4$$w0rd',
      };
      const hostRule2 = {
        hostType: 'github',
        matchHost: 'github.com',
        token: 'token',
      };
      add(hostRule1);
      add(hostRule2);
      expect(getAll()).toMatchObject([hostRule1, hostRule2]);
    });
  });

  describe('hostType()', () => {
    it('return hostType', () => {
      add({
        hostType: 'github',
        token: 'aaaaaa',
      });
      add({
        hostType: 'github',
        matchHost: 'github.example.com',
        token: 'abc',
      });
      add({
        hostType: 'github-changelog',
        matchHost: 'https://github.example.com/chalk/chalk',
        token: 'def',
      });
      expect(
        hostType({
          url: 'https://github.example.com/chalk/chalk',
        }),
      ).toBe('github-changelog');
    });

    it('returns null', () => {
      add({
        hostType: 'github',
        token: 'aaaaaa',
      });
      add({
        hostType: 'github',
        matchHost: 'github.example.com',
        token: 'abc',
      });
      add({
        hostType: 'github-changelog',
        matchHost: 'https://github.example.com/chalk/chalk',
        token: 'def',
      });
      expect(
        hostType({
          url: 'https://github.example.com/chalk/chalk',
        }),
      ).toBe('github-changelog');
      expect(
        hostType({
          url: 'https://gitlab.example.com/chalk/chalk',
        }),
      ).toBeNull();
    });
  });
});
