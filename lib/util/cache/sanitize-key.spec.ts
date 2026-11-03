import { toSha256 } from '../hash.ts';
import * as hostRules from '../host-rules.ts';
import { hashUserinfoAndQuery, sanitizeKey } from './sanitize-key.ts';

function hash(value: string): string {
  return `sha256-${toSha256(value).slice(0, 16)}`;
}

describe('util/cache/sanitize-key', () => {
  const userHash = hash('user:pass');

  it.each`
    key                                                          | expected
    ${'foo:bar'}                                                 | ${'foo:bar'}
    ${'https://example.com/foo:bar'}                             | ${'https://example.com/foo:bar'}
    ${'https://user:pass@example.com'}                           | ${`https://${userHash}@example.com`}
    ${'https://user:pass@example.com/foo:bar'}                   | ${`https://${userHash}@example.com/foo:bar`}
    ${'getReleases:https://user:pass@example.com:some-package'}  | ${`getReleases:https://${userHash}@example.com:some-package`}
    ${'git+ssh://user:pass@example.com'}                         | ${`git+ssh://${userHash}@example.com`}
    ${'https://user:pa@ss@example.com/'}                         | ${`https://${hash('user:pa@ss')}@example.com/`}
    ${'https://user:pass@example.com,https://user:pass@two.com'} | ${`https://${userHash}@example.com,https://${userHash}@two.com`}
    ${'https://token:@example.com'}                              | ${`https://${hash('token:')}@example.com`}
    ${'https://registry.npmjs.org:@types/node'}                  | ${`https://${hash('registry.npmjs.org:')}@types/node`}
    ${'https://0123456789abcdef@example.com'}                    | ${`https://${hash('0123456789abcdef')}@example.com`}
  `('sanitizes userinfo in $key', ({ key, expected }) => {
    expect(sanitizeKey(key)).toBe(expected);
  });

  it.each`
    key                                              | expected
    ${'https://example.com/pkg?token=abc'}           | ${`https://example.com/pkg?${hash('token=abc')}`}
    ${'https://user:pass@example.com/pkg?token=abc'} | ${`https://${userHash}@example.com/pkg?${hash('token=abc')}`}
    ${'getReleases:https://example.com/x?y=1:pkg'}   | ${`getReleases:https://example.com/x?${hash('y=1:pkg')}`}
    ${'https://example.com/pkg?token=abc#frag'}      | ${`https://example.com/pkg?${hash('token=abc')}#frag`}
    ${'https://example.com/?0123456789abcdef'}       | ${`https://example.com/?${hash('0123456789abcdef')}`}
    ${'https://example.com/?'}                       | ${'https://example.com/?'}
    ${'what?no-url'}                                 | ${'what?no-url'}
  `('sanitizes the query in $key', ({ key, expected }) => {
    expect(sanitizeKey(key)).toBe(expected);
  });

  it('keeps distinct credentials apart', () => {
    expect(sanitizeKey('https://user:one@example.com')).not.toBe(
      sanitizeKey('https://user:two@example.com'),
    );
    expect(sanitizeKey('https://example.com/?token=one')).not.toBe(
      sanitizeKey('https://example.com/?token=two'),
    );
  });

  it('leaves an unrelated @ alone', () => {
    expect(sanitizeKey('npm:@scope/package')).toBe('npm:@scope/package');
    expect(sanitizeKey('https://example.com/@scope/package')).toBe(
      'https://example.com/@scope/package',
    );
  });

  it.each`
    key
    ${'https://user:pass@example.com/pkg?token=abc'}
    ${'getReleases:https://user:pass@example.com:some-package'}
    ${'https://registry.npmjs.org:@types/node'}
  `('leaves the already sanitized $key unchanged', ({ key }) => {
    const sanitized = sanitizeKey(key);

    expect(sanitizeKey(sanitized)).toBe(sanitized);
  });

  describe('detached URL credentials', () => {
    afterEach(() => {
      hostRules.clear();
    });

    function credentialsHash(url: string): string {
      return hash(hostRules.getDetachedCredentialsHash(url)!);
    }

    it('gives the URL a hash of its detached credentials as userinfo', () => {
      hostRules.detachUrlCredentials('https://user:pass@example.com/maven', [
        'maven',
      ]);
      const userinfo = credentialsHash('https://example.com/maven');

      expect(sanitizeKey('getReleases:https://example.com/maven:pkg')).toBe(
        `getReleases:https://${userinfo}@example.com/maven:pkg`,
      );
    });

    it.each`
      url
      ${'https://user:secret@Nexus.Example.com/repo'}
      ${'https://user:secret@nexus.example.com:443/repo'}
    `(
      'gives every spelling of $url the hash of its detached credentials',
      ({ url }) => {
        const key = `getReleases:${url.replace('user:secret@', '')}:pkg`;
        const withoutCredentials = sanitizeKey(key);
        hostRules.detachUrlCredentials(url, ['maven']);
        const userinfo = credentialsHash('https://nexus.example.com/repo');

        expect(sanitizeKey(key)).toBe(
          key.replace('https://', `https://${userinfo}@`),
        );
        expect(sanitizeKey(key)).not.toBe(withoutCredentials);
        expect(
          sanitizeKey('getReleases:https://nexus.example.com/repo:pkg'),
        ).toBe(`getReleases:https://${userinfo}@nexus.example.com/repo:pkg`);
      },
    );

    it.each`
      key
      ${'getReleases:https://user@example.com/maven:pkg'}
      ${'getReleases:https://example.com:@scope/pkg'}
    `(
      'gives $key with a userinfo of its own a hash of the detached credentials',
      ({ key }) => {
        const withoutCredentials = sanitizeKey(key);
        hostRules.detachUrlCredentials('https://user:pass@example.com', [
          'maven',
        ]);

        const sanitized = sanitizeKey(key);

        expect(sanitized).not.toBe(withoutCredentials);
        expect(sanitized).toMatch(
          /^getReleases:https:\/\/sha256-[\da-f]{16}@[^@]+$/,
        );
        expect(sanitizeKey(sanitized)).toBe(sanitized);
      },
    );

    it('gives a sparse registry URL a hash of its detached credentials', () => {
      const key = 'sparse+https://crates.example.com/index:pkg';
      const withoutCredentials = sanitizeKey(key);
      hostRules.detachUrlCredentials(
        'sparse+https://user:pass1234567890123@crates.example.com/index',
        ['crate'],
      );
      const userinfo = credentialsHash('https://crates.example.com/index');

      expect(sanitizeKey(key)).toBe(
        `sparse+https://${userinfo}@crates.example.com/index:pkg`,
      );
      expect(sanitizeKey(key)).not.toBe(withoutCredentials);
    });

    it('keeps the keys of a URL with different detached credentials apart', () => {
      hostRules.detachUrlCredentials('https://user:one@example.com/maven', [
        'maven',
      ]);
      const first = sanitizeKey('https://example.com/maven:pkg');
      hostRules.clear();
      hostRules.detachUrlCredentials('https://user:two@example.com/maven', [
        'maven',
      ]);
      const second = sanitizeKey('https://example.com/maven:pkg');

      expect(first).not.toBe(second);
    });

    it.each`
      key
      ${'https://example.com/maven2:pkg'}
      ${'https://example.com/other:pkg'}
      ${'https://other.com/maven:pkg'}
      ${'foo:bar'}
    `('leaves $key without detached credentials unchanged', ({ key }) => {
      hostRules.detachUrlCredentials('https://user:pass@example.com/maven', [
        'maven',
      ]);

      expect(sanitizeKey(key)).toBe(key);
    });

    it('hashes the detached credentials of every URL in a key', () => {
      hostRules.detachUrlCredentials('https://user:one@example.com/maven', [
        'maven',
      ]);
      hostRules.detachUrlCredentials('https://user:two@other.com/', ['npm']);
      const first = credentialsHash('https://example.com/maven');
      const second = credentialsHash('https://other.com');

      expect(
        sanitizeKey(
          'https://example.com/maven/pkg,https://plain.com,https://other.com/pkg?token=abc',
        ),
      ).toBe(
        `https://${first}@example.com/maven/pkg,https://plain.com,https://${second}@other.com/pkg?${hash('token=abc')}`,
      );
    });

    it('hashes only userinfo and query without the detached credentials', () => {
      hostRules.detachUrlCredentials('https://user:pass@example.com/maven', [
        'maven',
      ]);

      expect(
        hashUserinfoAndQuery('https://example.com/maven/pkg?token=abc'),
      ).toBe(`https://example.com/maven/pkg?${hash('token=abc')}`);
      expect(hashUserinfoAndQuery('https://user:pass@example.com/maven')).toBe(
        `https://${userHash}@example.com/maven`,
      );
    });

    it('leaves a key with detached credentials unchanged when sanitized again', () => {
      hostRules.detachUrlCredentials('https://user:pass@example.com/maven', [
        'maven',
      ]);
      const sanitized = sanitizeKey('https://example.com/maven/pkg?token=abc');

      expect(sanitizeKey(sanitized)).toBe(sanitized);
    });
  });
});
