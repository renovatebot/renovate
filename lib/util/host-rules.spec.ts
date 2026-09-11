import { logger, partial } from '~test/util.ts';
import { GlobalConfig } from '../config/global.ts';
import { NugetDatasource } from '../modules/datasource/nuget/index.ts';
import type { HostRule } from '../types/index.ts';
import {
  type LegacyHostRule,
  add,
  clear,
  confidentialFields,
  filterAllowedHeaders,
  find,
  findAll,
  getAll,
  hostType,
  hosts,
} from './host-rules.ts';
import { redactedFields, sanitize } from './sanitize.ts';

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

    it('drops headers not permitted by allowedHeaders, with a warning', () => {
      // enforced within `add()` itself, so that no registration path (config, .npmrc, a future caller) can bypass `allowedHeaders`
      add({
        matchHost: 'registry.example.com',
        headers: { 'X-Allowed': 'yes', Authorization: 'denied' },
      });

      expect(find({ url: 'https://registry.example.com' })).toEqual({
        headers: { 'X-Allowed': 'yes' },
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

    it('prefers an explicitly-passed allowlist over GlobalConfig', () => {
      // used when registering rules for a repository before `GlobalConfig` reflects it, i.e. a `repositories[]` entry's own `allowedHeaders` override
      add(
        {
          matchHost: 'registry.example.com',
          headers: { Authorization: 'from-admin', 'X-Dropped': 'yes' },
        },
        { allowedHeaders: ['Authorization'] },
      );

      expect(find({ url: 'https://registry.example.com' })).toEqual({
        headers: { Authorization: 'from-admin' },
      });
      expect(logger.logger.warn).toHaveBeenCalledWith(
        { denied: ['X-Dropped'] },
        "Ignoring hostRules headers not permitted by this Renovate instance's `allowedHeaders`",
      );
    });
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

    it('prefers an explicitly-passed allowlist over GlobalConfig', () => {
      expect(
        filterAllowedHeaders(
          [
            {
              matchHost: 'registry.example.com',
              headers: { Authorization: 'from-admin', 'X-Dropped': 'yes' },
            },
          ],
          ['Authorization'],
        ),
      ).toEqual([
        {
          matchHost: 'registry.example.com',
          headers: { Authorization: 'from-admin' },
        },
      ]);
      expect(logger.logger.warn).toHaveBeenCalledWith(
        { denied: ['X-Dropped'] },
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
      });
      expect(find({ url: 'https://trusted.example.com' })).toEqual({
        headers: { 'X-Api-Key': 'secret' },
        internalHostGrant: { implicit: true },
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
      ).toEqual({ headers: { 'X-Custom': 'from-hostType-rule' } });
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
