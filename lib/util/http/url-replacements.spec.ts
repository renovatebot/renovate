import { logger } from '~test/util.ts';
import { GlobalConfig } from '../../config/global.ts';
import * as hostRules from '../host-rules.ts';
import { parseUrl } from '../url.ts';
import {
  applyUrlReplacements,
  hostRuleHasCredentials,
} from './url-replacements.ts';

const mavenCentral = 'https://repo.maven.apache.org/maven2/';
const mirror = 'https://mirror.example.com/maven-public/';
const artifactUrl = `${mavenCentral}org/example/foo/maven-metadata.xml`;

describe('util/http/url-replacements', () => {
  describe('applyUrlReplacements', () => {
    afterEach(() => {
      GlobalConfig.reset();
    });

    it('applies the rules in order to the result of the previous one', () => {
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
        }).toString(),
      ).toBe(`${mirror}org/example/foo/maven-metadata.xml`);
    });

    it('returns the url unchanged without rules', () => {
      const url = parseUrl(artifactUrl)!;

      expect(applyUrlReplacements(url, { hostType: 'maven' })).toBe(url);
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

      expect(res.toString()).toBe(
        `${mirror}org/example/foo/maven-metadata.xml`,
      );
      expect(logger.logger.once.debug).toHaveBeenCalledWith(
        `urlReplacements: replacing ${mavenCentral} -> ${mirror}`,
      );
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

        expect(applyUrlReplacements(parsedUrl, { hostType: 'maven' })).toBe(
          parsedUrl,
        );
      },
    );

    it('skips a rule whose matchHostTypes is a string', () => {
      GlobalConfig.set({
        urlReplacements: [
          {
            matchUrlPrefix: mavenCentral,
            replaceUrlPrefix: mirror,
            matchHostTypes: 'maven-releases' as never,
          },
        ],
      });
      const url = parseUrl(artifactUrl)!;

      expect(applyUrlReplacements(url, { hostType: 'maven' })).toBe(url);
    });

    it('never replaces docker requests', () => {
      GlobalConfig.set({
        urlReplacements: [
          {
            matchUrlPrefix: 'https://index.docker.io/',
            replaceUrlPrefix: 'https://mirror.example.com/docker/',
          },
        ],
      });
      const url = parseUrl(
        'https://index.docker.io/v2/library/node/tags/list',
      )!;

      expect(applyUrlReplacements(url, { hostType: 'docker' })).toBe(url);
    });

    it.each`
      matchHostTypes      | hostType     | expected
      ${['maven']}        | ${'maven'}   | ${`${mirror}foo`}
      ${['npm', 'maven']} | ${'maven'}   | ${`${mirror}foo`}
      ${['npm']}          | ${'maven'}   | ${`${mavenCentral}foo`}
      ${['maven']}        | ${undefined} | ${`${mavenCentral}foo`}
      ${undefined}        | ${undefined} | ${`${mirror}foo`}
    `(
      'matchHostTypes=$matchHostTypes with hostType=$hostType gives $expected',
      ({ matchHostTypes, hostType, expected }) => {
        GlobalConfig.set({
          urlReplacements: [
            {
              matchUrlPrefix: mavenCentral,
              replaceUrlPrefix: mirror,
              matchHostTypes,
            },
          ],
        });

        expect(
          applyUrlReplacements(parseUrl(`${mavenCentral}foo`)!, {
            hostType,
          }).toString(),
        ).toBe(expected);
      },
    );

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
        ).toBe(url);
        expect(logger.logger.debug).toHaveBeenCalledWith(
          `urlReplacements: not replacing ${artifactUrl}, the request has credentials`,
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

          expect(applyUrlReplacements(url, { hostType: 'maven' })).toBe(url);
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

        expect(applyUrlReplacements(url, { hostType: 'maven' })).toBe(url);
      });

      it('replaces when the host rule for the original url only has a username', () => {
        hostRules.add(
          { matchHost: 'repo.maven.apache.org', username: 'user' },
          { trusted: true },
        );

        expect(
          applyUrlReplacements(parseUrl(artifactUrl)!, {
            hostType: 'maven',
          }).toString(),
        ).toBe(`${mirror}org/example/foo/maven-metadata.xml`);
      });

      it('does not replace when the original host is disabled', () => {
        hostRules.add(
          { matchHost: 'repo.maven.apache.org', enabled: false },
          { trusted: true },
        );
        const url = parseUrl(artifactUrl)!;

        expect(applyUrlReplacements(url, { hostType: 'maven' })).toBe(url);
        expect(logger.logger.debug).toHaveBeenCalledWith(
          `urlReplacements: not replacing ${artifactUrl}, the host is disabled`,
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
          }).toString(),
        ).toBe(`${mirror}org/example/foo/maven-metadata.xml`);
      });
    });
  });

  describe('hostRuleHasCredentials', () => {
    it.each`
      name                       | rule                                   | expected
      ${'token'}                 | ${{ token: 'secret' }}                 | ${true}
      ${'empty password'}        | ${{ password: '' }}                    | ${true}
      ${'client certificate'}    | ${{ httpsCertificate: 'cert' }}        | ${true}
      ${'client private key'}    | ${{ httpsPrivateKey: 'key' }}          | ${true}
      ${'header'}                | ${{ headers: { 'X-Api-Key': 'key' } }} | ${true}
      ${'certificate authority'} | ${{ httpsCertificateAuthority: 'ca' }} | ${false}
      ${'username'}              | ${{ username: 'user' }}                | ${false}
      ${'timeout'}               | ${{ timeout: 1000 }}                   | ${false}
    `('is $expected for a $name', ({ rule, expected }) => {
      expect(hostRuleHasCredentials(rule)).toBe(expected);
    });
  });
});
