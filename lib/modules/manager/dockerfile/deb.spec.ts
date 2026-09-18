import { codeBlock } from 'common-tags';
import { DateTime } from 'luxon';
import { detectDebRegistryUrls, extractDebDeps } from './deb.ts';

const escapeChar = '\\\\';

const debian = 'https://deb.debian.org/debian';
const debianParams = 'components=main,contrib,non-free&binaryArch=amd64';
const ubuntu = 'https://archive.ubuntu.com/ubuntu';
const ubuntuSecurity = 'https://security.ubuntu.com/ubuntu';
const ubuntuParams =
  'components=main,restricted,universe,multiverse&binaryArch=amd64';

describe('modules/manager/dockerfile/deb', () => {
  // Debian's rolling aliases name whichever release is current, so the clock is
  // pinned to a date at which `stable` was bookworm and `oldstable` bullseye
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(DateTime.fromISO('2024-07-01').valueOf());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  describe('extractDebDeps()', () => {
    it('ignores instructions which are not RUN', () => {
      expect(extractDebDeps('FROM debian:bookworm', escapeChar)).toBeEmpty();
      expect(
        extractDebDeps(
          'CMD ["apt-get", "install", "curl=8.14.1-2"]',
          escapeChar,
        ),
      ).toBeEmpty();
      // an `ENV` looks superficially like a `name=version` package spec
      expect(extractDebDeps('ENV APP_PORT=5000', escapeChar)).toBeEmpty();
      expect(
        extractDebDeps('ENV CURL_VERSION=8.14.1-2', escapeChar),
      ).toBeEmpty();
    });

    it('ignores RUN instructions without apt', () => {
      expect(
        extractDebDeps('RUN apk add --no-cache curl=8.12.1-r1', escapeChar),
      ).toBeEmpty();
    });

    it('ignores apt sub-commands other than install', () => {
      expect(
        extractDebDeps(
          'RUN apt-get update && apt-get remove -y curl && apt-get clean',
          escapeChar,
        ),
      ).toBeEmpty();
    });

    it('ignores commands which merely mention apt', () => {
      expect(
        extractDebDeps('RUN rm -rf /var/lib/apt/lists/*', escapeChar),
      ).toBeEmpty();
    });

    it('extracts a pinned package', () => {
      expect(
        extractDebDeps('RUN apt-get install -y curl=8.14.1-2', escapeChar),
      ).toEqual([
        {
          datasource: 'deb',
          depName: 'curl',
          currentValue: '8.14.1-2',
          replaceString: 'curl=8.14.1-2',
          autoReplaceStringTemplate: 'curl={{{newValue}}}',
        },
      ]);
    });

    it('extracts a package pinned with an epoch', () => {
      expect(
        extractDebDeps('RUN apt install -y git=1:2.47.3-0+deb13u1', escapeChar),
      ).toEqual([
        {
          datasource: 'deb',
          depName: 'git',
          currentValue: '1:2.47.3-0+deb13u1',
          replaceString: 'git=1:2.47.3-0+deb13u1',
          autoReplaceStringTemplate: 'git={{{newValue}}}',
        },
      ]);
    });

    it('extracts packages across line continuations and comments', () => {
      const instruction = codeBlock`
        RUN apt-get update && \\
            # install our runtime dependencies
            apt-get install -y --no-install-recommends \\
                curl=8.14.1-2 \\
                ca-certificates \\
                python3-pip \\
                git=1:2.47.3-0+deb13u1`;

      expect(extractDebDeps(instruction, escapeChar)).toEqual([
        {
          datasource: 'deb',
          depName: 'curl',
          currentValue: '8.14.1-2',
          replaceString: 'curl=8.14.1-2',
          autoReplaceStringTemplate: 'curl={{{newValue}}}',
        },
        {
          datasource: 'deb',
          depName: 'ca-certificates',
          skipReason: 'unspecified-version',
        },
        {
          datasource: 'deb',
          depName: 'python3-pip',
          skipReason: 'unspecified-version',
        },
        {
          datasource: 'deb',
          depName: 'git',
          currentValue: '1:2.47.3-0+deb13u1',
          replaceString: 'git=1:2.47.3-0+deb13u1',
          autoReplaceStringTemplate: 'git={{{newValue}}}',
        },
      ]);
    });

    it('supports the backtick escape character', () => {
      const instruction = 'RUN apt-get install -y `\n    curl=8.14.1-2';
      expect(extractDebDeps(instruction, '`')).toEqual([
        {
          datasource: 'deb',
          depName: 'curl',
          currentValue: '8.14.1-2',
          replaceString: 'curl=8.14.1-2',
          autoReplaceStringTemplate: 'curl={{{newValue}}}',
        },
      ]);
    });

    it('handles CRLF line continuations', () => {
      expect(
        extractDebDeps(
          'RUN apt-get install -y \\\r\n    curl=8.14.1-2',
          escapeChar,
        ),
      ).toEqual([
        {
          datasource: 'deb',
          depName: 'curl',
          currentValue: '8.14.1-2',
          replaceString: 'curl=8.14.1-2',
          autoReplaceStringTemplate: 'curl={{{newValue}}}',
        },
      ]);
    });

    it('skips the RUN flags and ONBUILD prefix', () => {
      expect(
        extractDebDeps(
          'ONBUILD RUN --mount=type=cache,target=/var/cache/apt --network=default apt-get install -y curl=8.14.1-2',
          escapeChar,
        ),
      ).toEqual([
        {
          datasource: 'deb',
          depName: 'curl',
          currentValue: '8.14.1-2',
          replaceString: 'curl=8.14.1-2',
          autoReplaceStringTemplate: 'curl={{{newValue}}}',
        },
      ]);
    });

    it('accepts global options before the sub-command', () => {
      expect(
        extractDebDeps(
          'RUN /usr/bin/apt-get -o Acquire::Retries=3 -t bookworm-backports install -y curl=8.14.1-2',
          escapeChar,
        ),
      ).toEqual([
        {
          datasource: 'deb',
          depName: 'curl',
          currentValue: '8.14.1-2',
          replaceString: 'curl=8.14.1-2',
          autoReplaceStringTemplate: 'curl={{{newValue}}}',
        },
      ]);
    });

    it('strips quotes from package specs', () => {
      expect(
        extractDebDeps(
          `RUN apt-get install -y "nginx=1.26.3-3" 'curl=8.14.1-2'`,
          escapeChar,
        ),
      ).toEqual([
        {
          datasource: 'deb',
          depName: 'nginx',
          currentValue: '1.26.3-3',
          replaceString: 'nginx=1.26.3-3',
          autoReplaceStringTemplate: 'nginx={{{newValue}}}',
        },
        {
          datasource: 'deb',
          depName: 'curl',
          currentValue: '8.14.1-2',
          replaceString: 'curl=8.14.1-2',
          autoReplaceStringTemplate: 'curl={{{newValue}}}',
        },
      ]);
    });

    it('preserves an architecture qualifier when replacing', () => {
      expect(
        extractDebDeps(
          'RUN apt-get install -y curl:amd64=8.14.1-2',
          escapeChar,
        ),
      ).toEqual([
        {
          datasource: 'deb',
          depName: 'curl',
          currentValue: '8.14.1-2',
          replaceString: 'curl:amd64=8.14.1-2',
          autoReplaceStringTemplate: 'curl:amd64={{{newValue}}}',
        },
      ]);
    });

    it.each`
      spec                         | skipReason
      ${'curl'}                    | ${'unspecified-version'}
      ${'curl:amd64'}              | ${'unspecified-version'}
      ${'curl/bookworm-backports'} | ${'unspecified-version'}
      ${'curl=$CURL_VERSION'}      | ${'contains-variable'}
      ${'curl=${CURL_VERSION}'}    | ${'contains-variable'}
      ${'curl=8.14.*'}             | ${'unsupported-version'}
    `('skips $spec with $skipReason', ({ spec, skipReason }) => {
      expect(
        extractDebDeps(`RUN apt-get install -y '${spec}'`, escapeChar),
      ).toEqual([
        {
          datasource: 'deb',
          depName: 'curl',
          skipReason,
        },
      ]);
    });

    it.each`
      spec
      ${'./curl_8.14.1-2_amd64.deb'}
      ${'/tmp/curl_8.14.1-2_amd64.deb'}
      ${'https://example.com/curl_8.14.1-2_amd64.deb'}
      ${'vim-'}
      ${'vim+'}
      ${'^gnome-desktop$'}
      ${'linux-image-*'}
      ${'$PACKAGE'}
    `('ignores the $spec package spec', ({ spec }) => {
      expect(
        extractDebDeps(`RUN apt-get install -y '${spec}'`, escapeChar),
      ).toBeEmpty();
    });

    it('stops at a shell comment', () => {
      expect(
        extractDebDeps(
          'RUN apt-get install -y curl=8.14.1-2 # apt-get install -y nginx=1.26.3-3',
          escapeChar,
        ),
      ).toEqual([
        {
          datasource: 'deb',
          depName: 'curl',
          currentValue: '8.14.1-2',
          replaceString: 'curl=8.14.1-2',
          autoReplaceStringTemplate: 'curl={{{newValue}}}',
        },
      ]);
    });

    it('extracts an apt-get install prefixed by variable assignments', () => {
      expect(
        extractDebDeps(
          'RUN DEBIAN_FRONTEND=noninteractive apt-get install -y curl=8.14.1-2',
          escapeChar,
        ),
      ).toEqual([
        {
          datasource: 'deb',
          depName: 'curl',
          currentValue: '8.14.1-2',
          replaceString: 'curl=8.14.1-2',
          autoReplaceStringTemplate: 'curl={{{newValue}}}',
        },
      ]);
    });

    it('extracts an apt install which directly follows a shell keyword', () => {
      expect(
        extractDebDeps(
          'RUN for i in 1 2; do apt-get install -y curl=8.14.1-2; done',
          escapeChar,
        ),
      ).toEqual([
        {
          datasource: 'deb',
          depName: 'curl',
          currentValue: '8.14.1-2',
          replaceString: 'curl=8.14.1-2',
          autoReplaceStringTemplate: 'curl={{{newValue}}}',
        },
      ]);
    });

    it('handles a command it cannot tokenize', () => {
      expect(
        extractDebDeps('RUN apt-get install -y "curl=8.14.1-2', escapeChar),
      ).toBeEmpty();
    });
  });

  describe('detectDebRegistryUrls()', () => {
    it('returns nothing for an image it cannot identify', () => {
      // a `FROM` which Renovate could not parse
      expect(
        detectDebRegistryUrls({ skipReason: 'contains-variable' }),
      ).toBeUndefined();
      // built on Debian, but its name does not say which release
      expect(
        detectDebRegistryUrls({ depName: 'node', currentValue: '22' }),
      ).toBeUndefined();
      expect(detectDebRegistryUrls({ depName: 'node' })).toBeUndefined();
      // an Alpine tag suffix is not a Debian codename
      expect(
        detectDebRegistryUrls({
          depName: 'node',
          currentValue: '22-alpine3.21',
        }),
      ).toBeUndefined();
      // a suite with no release of its own
      expect(
        detectDebRegistryUrls({ depName: 'debian', currentValue: 'sid' }),
      ).toBeUndefined();
      // Ubuntu's floating tags name no release
      expect(
        detectDebRegistryUrls({ depName: 'ubuntu', currentValue: 'rolling' }),
      ).toBeUndefined();
      expect(detectDebRegistryUrls({ depName: 'ubuntu' })).toBeUndefined();
    });

    it('detects the suite of the debian image', () => {
      expect(
        detectDebRegistryUrls({ depName: 'debian', currentValue: 'trixie' }),
      ).toEqual([`${debian}?suite=trixie&${debianParams}`]);
    });

    it('detects the suite of a registry-qualified debian image', () => {
      expect(
        detectDebRegistryUrls({
          depName: 'public.ecr.aws/docker/library/debian',
          currentValue: 'bookworm',
        }),
      ).toEqual([`${debian}?suite=bookworm&${debianParams}`]);
    });

    it('detects the suite a debian version names', () => {
      const bookworm = [`${debian}?suite=bookworm&${debianParams}`];
      expect(
        detectDebRegistryUrls({ depName: 'debian', currentValue: '12' }),
      ).toEqual(bookworm);
      // a point release names no suite of its own
      expect(
        detectDebRegistryUrls({ depName: 'debian', currentValue: '12.11' }),
      ).toEqual(bookworm);
    });

    it('ignores the variant and build date of a debian tag', () => {
      const bookworm = [`${debian}?suite=bookworm&${debianParams}`];
      expect(
        detectDebRegistryUrls({
          depName: 'debian',
          currentValue: 'bookworm-slim',
        }),
      ).toEqual(bookworm);
      expect(
        detectDebRegistryUrls({
          depName: 'debian',
          currentValue: 'bookworm-20240110-slim',
        }),
      ).toEqual(bookworm);
    });

    it('resolves the debian rolling aliases', () => {
      expect(
        detectDebRegistryUrls({
          depName: 'debian',
          currentValue: 'stable-slim',
        }),
      ).toEqual([`${debian}?suite=bookworm&${debianParams}`]);
      expect(
        detectDebRegistryUrls({ depName: 'debian', currentValue: 'oldstable' }),
      ).toEqual([`${debian}?suite=bullseye&${debianParams}`]);
      // an untagged image, and `debian:latest`, are the current stable release
      const stable = [`${debian}?suite=bookworm&${debianParams}`];
      expect(
        detectDebRegistryUrls({ depName: 'debian', currentValue: 'latest' }),
      ).toEqual(stable);
      expect(detectDebRegistryUrls({ depName: 'debian' })).toEqual(stable);
    });

    it('detects the suites of the ubuntu image', () => {
      const noble = [
        `${ubuntu}?suite=noble&${ubuntuParams}`,
        `${ubuntu}?suite=noble-updates&${ubuntuParams}`,
        `${ubuntuSecurity}?suite=noble-security&${ubuntuParams}`,
      ];
      expect(
        detectDebRegistryUrls({ depName: 'ubuntu', currentValue: 'noble' }),
      ).toEqual(noble);
      expect(
        detectDebRegistryUrls({ depName: 'ubuntu', currentValue: '24.04' }),
      ).toEqual(noble);
      expect(
        detectDebRegistryUrls({
          depName: 'ubuntu',
          currentValue: 'noble-20240801',
        }),
      ).toEqual(noble);
    });

    it('detects the release which another image tags itself with', () => {
      expect(
        detectDebRegistryUrls({
          depName: 'node',
          currentValue: '22-bookworm-slim',
        }),
      ).toEqual([`${debian}?suite=bookworm&${debianParams}`]);
      // the release comes last, after the tag's own version and variant
      expect(
        detectDebRegistryUrls({
          depName: 'python',
          currentValue: '3.12-slim-bookworm',
        }),
      ).toEqual([`${debian}?suite=bookworm&${debianParams}`]);
      expect(
        detectDebRegistryUrls({
          depName: 'eclipse-temurin',
          currentValue: '21-jdk-jammy',
        }),
      ).toEqual([
        `${ubuntu}?suite=jammy&${ubuntuParams}`,
        `${ubuntu}?suite=jammy-updates&${ubuntuParams}`,
        `${ubuntuSecurity}?suite=jammy-security&${ubuntuParams}`,
      ]);
    });
  });
});
