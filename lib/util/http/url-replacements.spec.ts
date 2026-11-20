import { logger } from '~test/util.ts';
import { GlobalConfig } from '../../config/global.ts';
import * as hostRules from '../host-rules.ts';
import { parseUrl } from '../url.ts';
import * as urlReplacementsModule from '../url-replacements.ts';
import {
  applyUrlReplacements,
  getRegistryUrlReplacements,
  getUrlReplacement,
} from './url-replacements.ts';

const mavenCentral = 'https://repo.maven.apache.org/maven2/';
const mirror = 'https://mirror.example.com/maven-public/';
const artifactUrl = `${mavenCentral}org/example/foo/maven-metadata.xml`;

describe('util/http/url-replacements', () => {
  describe('applyUrlReplacements', () => {
    afterEach(() => {
      GlobalConfig.reset();
    });

    it('builds the rules again only after urlReplacements changes', () => {
      const getUrlReplacements = vi.spyOn(
        urlReplacementsModule,
        'getUrlReplacements',
      );
      const urlReplacements = [
        { matchUrlPrefix: mavenCentral, replaceUrlPrefix: mirror },
      ];
      GlobalConfig.set({ urlReplacements });

      applyUrlReplacements(parseUrl(artifactUrl)!, { hostType: 'maven' });
      applyUrlReplacements(parseUrl(artifactUrl)!, { hostType: 'maven' });
      GlobalConfig.set({ urlReplacements: [...urlReplacements] });
      const res = applyUrlReplacements(parseUrl(artifactUrl)!, {
        hostType: 'maven',
      });

      expect(res.fetchUrl.toString()).toBe(
        `${mirror}org/example/foo/maven-metadata.xml`,
      );
      expect(getUrlReplacements).toHaveBeenCalledTimes(2);
    });

    it('builds the rules once while urlReplacements is unset', () => {
      const getUrlReplacements = vi.spyOn(
        urlReplacementsModule,
        'getUrlReplacements',
      );
      GlobalConfig.set({
        urlReplacements: [
          { matchUrlPrefix: mavenCentral, replaceUrlPrefix: mirror },
        ],
      });
      applyUrlReplacements(parseUrl(artifactUrl)!, { hostType: 'maven' });
      GlobalConfig.reset();
      const url = parseUrl(artifactUrl)!;

      applyUrlReplacements(url, { hostType: 'maven' });
      const res = applyUrlReplacements(url, { hostType: 'maven' });

      expect(res).toEqual({ fetchUrl: url });
      expect(getUrlReplacements).toHaveBeenCalledTimes(2);
    });

    it('skips a rule whose replaceUrlPrefix another rule rewrites', () => {
      GlobalConfig.set({
        urlReplacements: [
          {
            matchUrlPrefix: mavenCentral,
            replaceUrlPrefix: 'https://a.example.com/',
          },
          {
            matchUrlPrefix: 'https://a.example.com/',
            replaceUrlPrefix: mirror,
          },
          {
            matchUrlPrefix: mavenCentral,
            replaceUrlPrefix: 'https://b.example.com/',
          },
        ],
      });

      expect(
        applyUrlReplacements(parseUrl(artifactUrl)!, {
          hostType: 'maven',
        }).fetchUrl.toString(),
      ).toBe('https://b.example.com/org/example/foo/maven-metadata.xml');
      expect(logger.logger.once.warn).toHaveBeenCalledWith(
        {
          rule: {
            matchUrlPrefix: mavenCentral,
            replaceUrlPrefix: 'https://a.example.com/',
          },
        },
        'urlReplacements: ignoring a rule whose replaceUrlPrefix another rule rewrites',
      );
    });

    it('returns the url unchanged without rules', () => {
      const url = parseUrl(artifactUrl)!;

      expect(applyUrlReplacements(url, { hostType: 'maven' })).toEqual({
        fetchUrl: url,
      });
    });

    it('returns the url unchanged when no rule matches it', () => {
      GlobalConfig.set({
        urlReplacements: [
          { matchUrlPrefix: mavenCentral, replaceUrlPrefix: mirror },
        ],
      });
      const url = parseUrl('https://repo.example.com/maven2/foo')!;

      expect(applyUrlReplacements(url, { hostType: 'maven' })).toEqual({
        fetchUrl: url,
      });
    });

    it('replaces the url prefix', () => {
      GlobalConfig.set({
        urlReplacements: [
          { matchUrlPrefix: mavenCentral, replaceUrlPrefix: mirror },
        ],
      });

      const res = applyUrlReplacements(parseUrl(artifactUrl)!, {
        hostType: 'maven',
      });

      expect(res).toEqual({
        fetchUrl: parseUrl(`${mirror}org/example/foo/maven-metadata.xml`),
        hostRule: expect.any(Object),
      });
      expect(logger.logger.once.debug).not.toHaveBeenCalled();
    });

    it.each`
      matchUrlPrefix                 | replaceUrlPrefix                   | url
      ${'https://repo.example.com'}  | ${'https://mirror.example.com'}    | ${'https://repo.example.com.evil.example.net/x'}
      ${'https://repo.example.com'}  | ${'https://mirror.example.com/'}   | ${'https://repo.example.com/x'}
      ${'https://repo.example.com/'} | ${'https://mirror.example.com:'}   | ${'https://repo.example.com/x'}
      ${'https://repo.example.com/'} | ${'https://Mirror.example.com/'}   | ${'https://repo.example.com/x'}
      ${'https://repo.example.com/'} | ${'https://u@mirror.example.com/'} | ${'https://repo.example.com/x'}
    `(
      'skips the rule $matchUrlPrefix -> $replaceUrlPrefix for $url',
      ({ matchUrlPrefix, replaceUrlPrefix, url }) => {
        GlobalConfig.set({
          urlReplacements: [{ matchUrlPrefix, replaceUrlPrefix }],
        });
        const parsedUrl = parseUrl(url)!;

        expect(applyUrlReplacements(parsedUrl, { hostType: 'maven' })).toEqual({
          fetchUrl: parsedUrl,
        });
      },
    );

    it.each`
      hostType
      ${'docker'}
      ${'npm'}
      ${'clojure'}
      ${'sbt'}
      ${undefined}
    `('does not replace requests with hostType=$hostType', ({ hostType }) => {
      GlobalConfig.set({
        urlReplacements: [
          { matchUrlPrefix: mavenCentral, replaceUrlPrefix: mirror },
        ],
      });
      const url = parseUrl(artifactUrl)!;

      expect(applyUrlReplacements(url, { hostType })).toEqual({
        fetchUrl: url,
      });
    });

    describe('with credentials', () => {
      beforeEach(() => {
        GlobalConfig.set({
          urlReplacements: [
            { matchUrlPrefix: mavenCentral, replaceUrlPrefix: mirror },
          ],
        });
      });

      it.each`
        name                      | options
        ${'token'}                | ${{ token: 'secret' }}
        ${'username'}             | ${{ username: 'user' }}
        ${'password'}             | ${{ password: 'secret' }}
        ${'authorization header'} | ${{ headers: { Authorization: 'Basic abc' } }}
        ${'private-token header'} | ${{ headers: { 'Private-Token': 'abc' } }}
        ${'cookie header'}        | ${{ headers: { cookie: 'session=1' } }}
      `('does not replace with an explicit $name', ({ options }) => {
        const url = parseUrl(artifactUrl)!;

        expect(
          applyUrlReplacements(url, { hostType: 'maven', ...options }),
        ).toEqual({ fetchUrl: url, hostRule: expect.any(Object) });
        expect(logger.logger.once.debug).toHaveBeenCalledWith(
          `urlReplacements: not replacing ${mavenCentral}, the request has credentials`,
        );
      });

      it.each`
        name                       | rule
        ${'token'}                 | ${{ token: 'secret' }}
        ${'username and password'} | ${{ username: 'user', password: 'secret' }}
        ${'empty password'}        | ${{ username: 'user', password: '' }}
        ${'authorization header'}  | ${{ headers: { authorization: 'Bearer abc' } }}
        ${'client certificate'}    | ${{ httpsCertificate: 'cert' }}
        ${'client private key'}    | ${{ httpsPrivateKey: 'key' }}
        ${'certificate authority'} | ${{ httpsCertificateAuthority: 'ca' }}
      `(
        'does not replace when the host rule for the original url has a $name',
        ({ rule }) => {
          hostRules.add(
            { matchHost: 'repo.maven.apache.org', ...rule },
            { trusted: true },
          );
          const url = parseUrl(artifactUrl)!;

          expect(applyUrlReplacements(url, { hostType: 'maven' })).toEqual({
            fetchUrl: url,
            hostRule: expect.objectContaining(rule),
          });
        },
      );

      it('does not replace when the host rule for the original url has any header', () => {
        hostRules.add(
          {
            matchHost: 'repo.maven.apache.org',
            headers: { 'X-Api-Key': 'secret' },
          },
          { trusted: true },
        );
        const url = parseUrl(artifactUrl)!;

        expect(applyUrlReplacements(url, { hostType: 'maven' })).toEqual({
          fetchUrl: url,
          hostRule: expect.objectContaining({
            headers: { 'X-Api-Key': 'secret' },
          }),
        });
      });

      it('replaces when the host rule for the original url only has a username', () => {
        hostRules.add(
          { matchHost: 'repo.maven.apache.org', username: 'user' },
          { trusted: true },
        );

        expect(
          applyUrlReplacements(parseUrl(artifactUrl)!, {
            hostType: 'maven',
          }),
        ).toEqual({
          fetchUrl: parseUrl(`${mirror}org/example/foo/maven-metadata.xml`),
          hostRule: expect.any(Object),
        });
      });

      it('does not replace when the original host is disabled', () => {
        hostRules.add(
          { matchHost: 'repo.maven.apache.org', enabled: false },
          { trusted: true },
        );
        const url = parseUrl(artifactUrl)!;

        expect(applyUrlReplacements(url, { hostType: 'maven' })).toEqual({
          fetchUrl: url,
          hostRule: expect.objectContaining({ enabled: false }),
        });
        expect(logger.logger.once.debug).toHaveBeenCalledWith(
          `urlReplacements: not replacing ${mavenCentral}, the host is disabled`,
        );
      });

      it('logs the matched prefix instead of the url', () => {
        hostRules.add(
          { matchHost: 'repo.maven.apache.org', enabled: false },
          { trusted: true },
        );

        applyUrlReplacements(parseUrl(artifactUrl)!, { hostType: 'maven' });
        applyUrlReplacements(parseUrl(`${mavenCentral}org/other/bar.pom`)!, {
          hostType: 'maven',
        });

        expect(logger.logger.once.debug).toHaveBeenCalledTimes(2);
        expect(logger.logger.once.debug).toHaveBeenNthCalledWith(
          2,
          `urlReplacements: not replacing ${mavenCentral}, the host is disabled`,
        );
      });

      it('replaces when the host rule has no credentials and the request only has other headers', () => {
        hostRules.add(
          { matchHost: 'repo.maven.apache.org', timeout: 1000 },
          { trusted: true },
        );

        expect(
          applyUrlReplacements(parseUrl(artifactUrl)!, {
            hostType: 'maven',
            headers: { 'user-agent': 'renovate', authorization: '' },
          }),
        ).toEqual({
          fetchUrl: parseUrl(`${mirror}org/example/foo/maven-metadata.xml`),
          hostRule: expect.any(Object),
        });
      });
    });
  });

  describe('getUrlReplacement', () => {
    beforeEach(() => {
      GlobalConfig.set({
        urlReplacements: [
          { matchUrlPrefix: mavenCentral, replaceUrlPrefix: mirror },
        ],
      });
    });

    afterEach(() => {
      GlobalConfig.reset();
    });

    it('returns the replaced url without logging', () => {
      expect(getUrlReplacement(artifactUrl, 'maven')).toBe(
        `${mirror}org/example/foo/maven-metadata.xml`,
      );
      expect(logger.logger.once.debug).not.toHaveBeenCalled();
    });

    it.each`
      hostType
      ${'clojure'}
      ${null}
      ${undefined}
    `('returns undefined for hostType=$hostType', ({ hostType }) => {
      expect(getUrlReplacement(artifactUrl, hostType)).toBeUndefined();
    });

    it('returns undefined without rules', () => {
      GlobalConfig.reset();

      expect(getUrlReplacement(artifactUrl, 'maven')).toBeUndefined();
    });

    it.each`
      name             | rule
      ${'credentials'} | ${{ token: 'secret' }}
      ${'enabled'}     | ${{ enabled: false }}
    `(
      'returns undefined when the host rule for the url has $name',
      ({ rule }) => {
        hostRules.add({ matchHost: 'repo.maven.apache.org', ...rule });

        expect(getUrlReplacement(artifactUrl, 'maven')).toBeUndefined();
        expect(logger.logger.once.debug).not.toHaveBeenCalled();
      },
    );

    it('uses read-only host rules', () => {
      hostRules.add({
        matchHost: 'repo.maven.apache.org',
        readOnly: true,
        token: 'secret',
      });

      expect(getUrlReplacement(artifactUrl, 'maven')).toBeUndefined();
    });

    it.each`
      url
      ${'https://Repo.Maven.Apache.org/maven2/org/example/foo/maven-metadata.xml'}
      ${'https://repo.maven.apache.org:443/maven2/org/example/foo/maven-metadata.xml'}
    `('normalizes $url like a request', ({ url }) => {
      expect(getUrlReplacement(url, 'maven')).toBe(
        `${mirror}org/example/foo/maven-metadata.xml`,
      );
    });

    it('returns undefined for an invalid url', () => {
      expect(getUrlReplacement('not a url', 'maven')).toBeUndefined();
    });
  });

  describe('getRegistryUrlReplacements', () => {
    afterEach(() => {
      GlobalConfig.reset();
    });

    it.each`
      registryUrl
      ${'https://repo.maven.apache.org/maven2'}
      ${'https://repo.maven.apache.org/maven2/'}
      ${'https://Repo.Maven.Apache.org:443/maven2'}
    `(
      'returns the mirror url of the registry $registryUrl',
      ({ registryUrl }) => {
        GlobalConfig.set({
          urlReplacements: [
            { matchUrlPrefix: mavenCentral, replaceUrlPrefix: mirror },
          ],
        });

        expect(getRegistryUrlReplacements(registryUrl, 'maven')).toEqual([
          mirror,
        ]);
      },
    );

    it('returns the mirror url of a registry below a rule', () => {
      GlobalConfig.set({
        urlReplacements: [
          {
            matchUrlPrefix: 'https://repo.maven.apache.org/',
            replaceUrlPrefix: 'https://mirror.example.com/',
          },
        ],
      });

      expect(getRegistryUrlReplacements(mavenCentral, 'maven')).toEqual([
        'https://mirror.example.com/maven2/',
      ]);
    });

    it('returns the mirror urls of the registry and of the rules below it', () => {
      GlobalConfig.set({
        urlReplacements: [
          {
            matchUrlPrefix: `${mavenCentral}org/apache/`,
            replaceUrlPrefix: 'https://mirror.example.com/maven-apache/',
          },
          {
            matchUrlPrefix: 'https://repo.maven.apache.org/',
            replaceUrlPrefix: 'https://mirror.example.com/',
          },
          {
            matchUrlPrefix: 'https://repo.example.com/',
            replaceUrlPrefix: 'https://mirror.example.com/other/',
          },
        ],
      });

      expect(getRegistryUrlReplacements(mavenCentral, 'maven')).toEqual([
        'https://mirror.example.com/maven2/',
        'https://mirror.example.com/maven-apache/',
      ]);
    });

    it('returns the mirror url of an artifactregistry registry', () => {
      GlobalConfig.set({
        urlReplacements: [
          {
            matchUrlPrefix: 'https://maven.pkg.dev/project/repository/',
            replaceUrlPrefix: mirror,
          },
        ],
      });

      expect(
        getRegistryUrlReplacements(
          'artifactregistry://maven.pkg.dev/project/repository',
          'maven',
        ),
      ).toEqual([mirror]);
    });

    it('skips a rule below the registry whose original host has credentials', () => {
      GlobalConfig.set({
        urlReplacements: [
          {
            matchUrlPrefix: `${mavenCentral}org/apache/`,
            replaceUrlPrefix: mirror,
          },
        ],
      });
      hostRules.add({ matchHost: 'repo.maven.apache.org', token: 'secret' });

      expect(getRegistryUrlReplacements(mavenCentral, 'maven')).toEqual([]);
    });

    it.each`
      registryUrl                    | hostType
      ${mavenCentral}                | ${'clojure'}
      ${'https://repo.example.com/'} | ${'maven'}
      ${'not a url'}                 | ${'maven'}
    `(
      'returns no mirror url for $registryUrl with hostType=$hostType',
      ({ registryUrl, hostType }) => {
        GlobalConfig.set({
          urlReplacements: [
            { matchUrlPrefix: mavenCentral, replaceUrlPrefix: mirror },
          ],
        });

        expect(getRegistryUrlReplacements(registryUrl, hostType)).toEqual([]);
      },
    );
  });

  describe('mirror host rules', () => {
    beforeEach(() => {
      GlobalConfig.set({
        urlReplacements: [
          { matchUrlPrefix: mavenCentral, replaceUrlPrefix: mirror },
        ],
      });
    });

    afterEach(() => {
      GlobalConfig.reset();
    });

    it.each`
      name                | rule
      ${'token'}          | ${{ token: 'secret' }}
      ${'empty password'} | ${{ password: '' }}
      ${'client cert'}    | ${{ httpsCertificate: 'cert' }}
      ${'client key'}     | ${{ httpsPrivateKey: 'key' }}
      ${'header'}         | ${{ headers: { 'X-Api-Key': 'key' } }}
    `('does not replace when the mirror has a $name', ({ rule }) => {
      hostRules.add(
        { matchHost: 'mirror.example.com', ...rule },
        { trusted: true },
      );
      const url = parseUrl(artifactUrl)!;

      expect(applyUrlReplacements(url, { hostType: 'maven' })).toEqual({
        fetchUrl: url,
        hostRule: expect.not.objectContaining(rule),
      });
      expect(getUrlReplacement(artifactUrl, 'maven')).toBeUndefined();
      expect(logger.logger.once.debug).toHaveBeenCalledWith(
        `urlReplacements: not replacing ${mavenCentral}, the mirror has credentials`,
      );
    });

    it.each`
      name                       | rule
      ${'certificate authority'} | ${{ httpsCertificateAuthority: 'ca' }}
      ${'username'}              | ${{ username: 'user' }}
      ${'timeout'}               | ${{ timeout: 1000 }}
    `('replaces when the mirror has a $name', ({ rule }) => {
      hostRules.add(
        { matchHost: 'mirror.example.com', ...rule },
        { trusted: true },
      );

      expect(
        applyUrlReplacements(parseUrl(artifactUrl)!, { hostType: 'maven' }),
      ).toEqual({
        fetchUrl: parseUrl(`${mirror}org/example/foo/maven-metadata.xml`),
        hostRule: expect.objectContaining(rule),
      });
    });
  });
});
