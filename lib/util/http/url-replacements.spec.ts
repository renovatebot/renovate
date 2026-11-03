import { logger, partial } from '~test/util.ts';
import { GlobalConfig } from '../../config/global.ts';
import { HOST_BLOCKED } from '../../constants/error-messages.ts';
import * as hostRules from '../host-rules.ts';
import { parseUrl } from '../url.ts';
import { RequestError } from './got.ts';
import {
  applyUrlReplacements,
  isFallbackError,
  removeCredentials,
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
        }).url.toString(),
      ).toBe(`${mirror}org/example/foo/maven-metadata.xml`);
    });

    it('returns the url unchanged without rules', () => {
      const url = parseUrl(artifactUrl)!;

      expect(applyUrlReplacements(url, { hostType: 'maven' }).url).toBe(url);
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

      expect(res.url.toString()).toBe(
        `${mirror}org/example/foo/maven-metadata.xml`,
      );
      expect(res.public).toBeFalse();
      expect(res.fallback).toBeFalse();
      expect(logger.logger.debug).toHaveBeenCalledWith(
        `urlReplacements: replacing ${artifactUrl} with ${mirror}org/example/foo/maven-metadata.xml`,
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

        expect(applyUrlReplacements(parsedUrl, { hostType: 'maven' }).url).toBe(
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

      expect(applyUrlReplacements(url, { hostType: 'maven' }).url).toBe(url);
    });

    it.each`
      first   | second       | expected
      ${true} | ${true}      | ${true}
      ${true} | ${false}     | ${false}
      ${true} | ${undefined} | ${false}
    `(
      'has fallback=$expected for chained rules with fallback $first and $second',
      ({ first, second, expected }) => {
        GlobalConfig.set({
          urlReplacements: [
            {
              matchUrlPrefix: mavenCentral,
              replaceUrlPrefix: 'https://a.example.com/',
              fallback: first,
            },
            {
              matchUrlPrefix: 'https://a.example.com/',
              replaceUrlPrefix: mirror,
              fallback: second,
            },
          ],
        });

        expect(
          applyUrlReplacements(parseUrl(artifactUrl)!, { hostType: 'maven' })
            .fallback,
        ).toBe(expected);
      },
    );

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

      expect(applyUrlReplacements(url, { hostType: 'docker' }).url).toBe(url);
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
          }).url.toString(),
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
          applyUrlReplacements(url, { hostType: 'maven', ...options }).url,
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

          expect(applyUrlReplacements(url, { hostType: 'maven' }).url).toBe(
            url,
          );
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

        expect(applyUrlReplacements(url, { hostType: 'maven' }).url).toBe(url);
      });

      it('replaces when the host rule for the original url only has a username', () => {
        hostRules.add(
          { matchHost: 'repo.maven.apache.org', username: 'user' },
          { trusted: true },
        );

        expect(
          applyUrlReplacements(parseUrl(artifactUrl)!, {
            hostType: 'maven',
          }).url.toString(),
        ).toBe(`${mirror}org/example/foo/maven-metadata.xml`);
      });

      it('does not replace when the original host is disabled', () => {
        hostRules.add(
          { matchHost: 'repo.maven.apache.org', enabled: false },
          { trusted: true },
        );
        const url = parseUrl(artifactUrl)!;

        expect(applyUrlReplacements(url, { hostType: 'maven' }).url).toBe(url);
        expect(logger.logger.debug).toHaveBeenCalledWith(
          `urlReplacements: not replacing ${artifactUrl}, the host is disabled`,
        );
      });

      it('replaces a public source despite credentials', () => {
        GlobalConfig.set({
          urlReplacements: [
            {
              matchUrlPrefix: mavenCentral,
              replaceUrlPrefix: mirror,
              public: true,
            },
          ],
        });
        hostRules.add(
          { matchHost: 'repo.maven.apache.org', token: 'secret' },
          { trusted: true },
        );

        const res = applyUrlReplacements(parseUrl(artifactUrl)!, {
          hostType: 'maven',
          password: 'secret',
        });

        expect(res.url.toString()).toBe(
          `${mirror}org/example/foo/maven-metadata.xml`,
        );
        expect(res.public).toBeTrue();
        expect(res.hadCredentials).toBeTrue();
      });

      it('does not replace a public source when the original host is disabled', () => {
        GlobalConfig.set({
          urlReplacements: [
            {
              matchUrlPrefix: mavenCentral,
              replaceUrlPrefix: mirror,
              public: true,
            },
          ],
        });
        hostRules.add(
          { matchHost: 'repo.maven.apache.org', enabled: false },
          { trusted: true },
        );
        const url = parseUrl(artifactUrl)!;

        expect(applyUrlReplacements(url, { hostType: 'maven' })).toEqual({
          url,
          public: false,
          fallback: false,
          hadCredentials: false,
        });
      });

      it('does not replace when not every applied rule is public', () => {
        GlobalConfig.set({
          urlReplacements: [
            {
              matchUrlPrefix: mavenCentral,
              replaceUrlPrefix: 'https://a.example.com/',
              public: true,
            },
            {
              matchUrlPrefix: 'https://a.example.com/',
              replaceUrlPrefix: mirror,
            },
          ],
        });
        const url = parseUrl(artifactUrl)!;

        expect(
          applyUrlReplacements(url, { hostType: 'maven', token: 'secret' }).url,
        ).toBe(url);
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
          }).url.toString(),
        ).toBe(`${mirror}org/example/foo/maven-metadata.xml`);
      });
    });
  });

  describe('removeCredentials', () => {
    it('removes the credentials of the caller', () => {
      expect(
        removeCredentials({
          hostType: 'maven',
          token: 'token',
          username: 'user',
          password: 'secret',
          headers: {
            Authorization: 'Basic abc',
            'Private-Token': 'gitlab-token',
            cookie: 'session=1',
            accept: 'text/xml',
          },
        }),
      ).toEqual({ hostType: 'maven', headers: { accept: 'text/xml' } });
    });

    it('works without headers', () => {
      expect(removeCredentials({ hostType: 'maven' })).toEqual({
        hostType: 'maven',
        headers: {},
      });
    });
  });

  describe('isFallbackError', () => {
    function requestError(
      message: string,
      { statusCode, code }: { statusCode?: number; code?: string } = {},
    ): RequestError {
      const err = new RequestError(message, { code }, partial<never>());
      if (statusCode) {
        Object.defineProperty(err, 'response', { value: { statusCode } });
      }
      return err;
    }

    it.each`
      name                     | err                                                              | expected
      ${'a connection error'}  | ${requestError('refused', { code: 'ECONNREFUSED' })}             | ${true}
      ${'a timeout'}           | ${requestError('timeout', { code: 'ETIMEDOUT' })}                | ${true}
      ${'a 500 response'}      | ${requestError('failed', { statusCode: 500 })}                   | ${true}
      ${'a 503 response'}      | ${requestError('failed', { statusCode: 503 })}                   | ${true}
      ${'a 404 response'}      | ${requestError('failed', { statusCode: 404 })}                   | ${false}
      ${'a blocked host'}      | ${requestError(HOST_BLOCKED)}                                    | ${false}
      ${'an expired cert'}     | ${requestError('expired', { code: 'CERT_HAS_EXPIRED' })}         | ${false}
      ${'a self-signed cert'}  | ${requestError('self', { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' })} | ${false}
      ${'an altname mismatch'} | ${requestError('alt', { code: 'ERR_TLS_CERT_ALTNAME_INVALID' })} | ${false}
      ${'an ssl error'}        | ${requestError('ssl', { code: 'ERR_SSL_WRONG_VERSION_NUMBER' })} | ${false}
      ${'another error'}       | ${new Error('failed')}                                           | ${false}
    `('is $expected for $name', ({ err, expected }) => {
      expect(isFallbackError(err)).toBe(expected);
    });
  });
});
