import { codeBlock } from 'common-tags';
import { extractApkDeps } from './apk.ts';

const escapeChar = '\\\\';

describe('modules/manager/dockerfile/apk', () => {
  describe('extractApkDeps()', () => {
    it('ignores instructions which are not RUN', () => {
      expect(extractApkDeps('FROM alpine:3.21', escapeChar)).toBeEmpty();
      expect(
        extractApkDeps('CMD ["apk", "add", "bash=5.2.37-r2"]', escapeChar),
      ).toBeEmpty();
      // an `ENV` looks superficially like a `name=version` package spec
      expect(extractApkDeps('ENV APP_PORT=5000', escapeChar)).toBeEmpty();
      expect(
        extractApkDeps('ENV CURL_VERSION=8.9.1-r4', escapeChar),
      ).toBeEmpty();
    });

    it('ignores RUN instructions without apk', () => {
      expect(
        extractApkDeps('RUN apt-get install -y bash', escapeChar),
      ).toBeEmpty();
    });

    it('ignores apk sub-commands other than add', () => {
      expect(
        extractApkDeps(
          'RUN apk upgrade --no-cache && apk del .build-deps',
          escapeChar,
        ),
      ).toBeEmpty();
    });

    it('ignores commands which merely mention apk', () => {
      expect(
        extractApkDeps('RUN rm -rf /var/cache/apk/*', escapeChar),
      ).toBeEmpty();
    });

    it('extracts a pinned package', () => {
      expect(
        extractApkDeps('RUN apk add --no-cache bash=5.2.37-r2', escapeChar),
      ).toEqual([
        {
          datasource: 'apk',
          depName: 'bash',
          currentValue: '5.2.37-r2',
          replaceString: 'bash=5.2.37-r2',
          autoReplaceStringTemplate: 'bash={{{newValue}}}',
        },
      ]);
    });

    it('extracts packages across line continuations and comments', () => {
      const instruction = codeBlock`
        RUN apk upgrade --no-cache && \\
            # install our runtime dependencies
            apk add --no-cache \\
                bash=5.2.37-r2 \\
                py3-pip \\
                python3 \\
                rsyslog=8.2412.0-r1 \\
                runit=2.2.0`;

      expect(extractApkDeps(instruction, escapeChar)).toEqual([
        {
          datasource: 'apk',
          depName: 'bash',
          currentValue: '5.2.37-r2',
          replaceString: 'bash=5.2.37-r2',
          autoReplaceStringTemplate: 'bash={{{newValue}}}',
        },
        {
          datasource: 'apk',
          depName: 'py3-pip',
          skipReason: 'unspecified-version',
        },
        {
          datasource: 'apk',
          depName: 'python3',
          skipReason: 'unspecified-version',
        },
        {
          datasource: 'apk',
          depName: 'rsyslog',
          currentValue: '8.2412.0-r1',
          replaceString: 'rsyslog=8.2412.0-r1',
          autoReplaceStringTemplate: 'rsyslog={{{newValue}}}',
        },
        {
          datasource: 'apk',
          depName: 'runit',
          currentValue: '2.2.0',
          replaceString: 'runit=2.2.0',
          autoReplaceStringTemplate: 'runit={{{newValue}}}',
        },
      ]);
    });

    it('supports the backtick escape character', () => {
      const instruction = 'RUN apk add `\n    bash=5.2.37-r2';
      expect(extractApkDeps(instruction, '`')).toEqual([
        {
          datasource: 'apk',
          depName: 'bash',
          currentValue: '5.2.37-r2',
          replaceString: 'bash=5.2.37-r2',
          autoReplaceStringTemplate: 'bash={{{newValue}}}',
        },
      ]);
    });

    it('handles CRLF line continuations', () => {
      expect(
        extractApkDeps('RUN apk add \\\r\n    bash=5.2.37-r2', escapeChar),
      ).toEqual([
        {
          datasource: 'apk',
          depName: 'bash',
          currentValue: '5.2.37-r2',
          replaceString: 'bash=5.2.37-r2',
          autoReplaceStringTemplate: 'bash={{{newValue}}}',
        },
      ]);
    });

    it('skips the RUN flags and ONBUILD prefix', () => {
      expect(
        extractApkDeps(
          'ONBUILD RUN --mount=type=cache,target=/var/cache/apk --network=default apk add bash=5.2.37-r2',
          escapeChar,
        ),
      ).toEqual([
        {
          datasource: 'apk',
          depName: 'bash',
          currentValue: '5.2.37-r2',
          replaceString: 'bash=5.2.37-r2',
          autoReplaceStringTemplate: 'bash={{{newValue}}}',
        },
      ]);
    });

    it('accepts global options before the sub-command', () => {
      expect(
        extractApkDeps(
          'RUN /sbin/apk --no-cache -X https://example.com/alpine/v3.21/main add -t .build-deps gcc=14.2.0-r4',
          escapeChar,
        ),
      ).toEqual([
        {
          datasource: 'apk',
          depName: 'gcc',
          currentValue: '14.2.0-r4',
          replaceString: 'gcc=14.2.0-r4',
          autoReplaceStringTemplate: 'gcc={{{newValue}}}',
        },
      ]);
    });

    it('strips quotes from package specs', () => {
      expect(
        extractApkDeps(
          `RUN apk add "nginx=1.26.2-r0" 'curl=8.12.1-r1'`,
          escapeChar,
        ),
      ).toEqual([
        {
          datasource: 'apk',
          depName: 'nginx',
          currentValue: '1.26.2-r0',
          replaceString: 'nginx=1.26.2-r0',
          autoReplaceStringTemplate: 'nginx={{{newValue}}}',
        },
        {
          datasource: 'apk',
          depName: 'curl',
          currentValue: '8.12.1-r1',
          replaceString: 'curl=8.12.1-r1',
          autoReplaceStringTemplate: 'curl={{{newValue}}}',
        },
      ]);
    });

    it('preserves a tagged repository suffix when replacing', () => {
      expect(
        extractApkDeps('RUN apk add nodejs@edge=22.13.1-r0', escapeChar),
      ).toEqual([
        {
          datasource: 'apk',
          depName: 'nodejs',
          currentValue: '22.13.1-r0',
          replaceString: 'nodejs@edge=22.13.1-r0',
          autoReplaceStringTemplate: 'nodejs@edge={{{newValue}}}',
        },
      ]);
    });

    it.each`
      spec           | currentValue
      ${'bash=~5.2'} | ${'=~5.2'}
      ${'bash~5.2'}  | ${'~5.2'}
      ${'bash~=5.2'} | ${'~=5.2'}
      ${'bash>5.2'}  | ${'>5.2'}
      ${'bash<5.2'}  | ${'<5.2'}
      ${'bash>=5.2'} | ${'>=5.2'}
      ${'bash<=5.2'} | ${'<=5.2'}
      ${'bash>~5.2'} | ${'>~5.2'}
      ${'bash<~5.2'} | ${'<~5.2'}
    `('extracts $spec as the range $currentValue', ({ spec, currentValue }) => {
      expect(extractApkDeps(`RUN apk add '${spec}'`, escapeChar)).toEqual([
        {
          datasource: 'apk',
          depName: 'bash',
          currentValue,
          replaceString: spec,
          autoReplaceStringTemplate: 'bash{{{newValue}}}',
        },
      ]);
    });

    it.each`
      spec                                  | skipReason
      ${'bash=$VERSION'}                    | ${'contains-variable'}
      ${'bash=not-a-version'}               | ${'unsupported-version'}
      ${'bash><Q12lvT0pPK3aQaUWmI9djiLpFg'} | ${'unsupported-version'}
    `('skips $spec with $skipReason', ({ spec, skipReason }) => {
      expect(extractApkDeps(`RUN apk add '${spec}'`, escapeChar)).toEqual([
        {
          datasource: 'apk',
          depName: 'bash',
          skipReason,
        },
      ]);
    });

    it.each`
      spec
      ${'!conflicting'}
      ${'.build-deps'}
      ${'./bash-5.2.37-r2.apk'}
      ${'https://example.com/bash-5.2.37-r2.apk'}
      ${'so:libc.musl-x86_64.so.1'}
      ${'cmd:node'}
      ${'$PACKAGE'}
    `('ignores the $spec package spec', ({ spec }) => {
      expect(extractApkDeps(`RUN apk add '${spec}'`, escapeChar)).toBeEmpty();
    });

    it('stops at a shell comment', () => {
      expect(
        extractApkDeps(
          'RUN apk add bash=5.2.37-r2 # apk add curl=8.12.1-r1',
          escapeChar,
        ),
      ).toEqual([
        {
          datasource: 'apk',
          depName: 'bash',
          currentValue: '5.2.37-r2',
          replaceString: 'bash=5.2.37-r2',
          autoReplaceStringTemplate: 'bash={{{newValue}}}',
        },
      ]);
    });

    it('extracts from a shell loop', () => {
      // https://github.com/elastic/elastic-agent/blob/09ae1f4dcf8305e27f5024d3486e6ef7fd1921ba/dev-tools/packaging/templates/docker/Dockerfile.elastic-agent.tmpl#L10-L15
      const instruction = codeBlock`
        RUN for iter in {1..10}; do \
                apk fix && \
                apk add --no-cache shadow libcap-utils && \
                exit_code=0 && break || exit_code=$? && echo "apk error: retry $iter in 10s" && sleep 10; \
            done; \
            (exit $exit_code)`;

      expect(extractApkDeps(instruction, escapeChar)).toEqual([
        {
          datasource: 'apk',
          depName: 'shadow',
          skipReason: 'unspecified-version',
        },
        {
          datasource: 'apk',
          depName: 'libcap-utils',
          skipReason: 'unspecified-version',
        },
      ]);
    });

    it('extracts an apk add which directly follows a shell keyword', () => {
      expect(
        extractApkDeps(
          'RUN for i in 1 2; do apk add bash=5.2.37-r2; done',
          escapeChar,
        ),
      ).toEqual([
        {
          datasource: 'apk',
          depName: 'bash',
          currentValue: '5.2.37-r2',
          replaceString: 'bash=5.2.37-r2',
          autoReplaceStringTemplate: 'bash={{{newValue}}}',
        },
      ]);
    });

    it('extracts an apk add prefixed by variable assignments', () => {
      expect(
        extractApkDeps('RUN DEBUG=1 apk add bash=5.2.37-r2', escapeChar),
      ).toEqual([
        {
          datasource: 'apk',
          depName: 'bash',
          currentValue: '5.2.37-r2',
          replaceString: 'bash=5.2.37-r2',
          autoReplaceStringTemplate: 'bash={{{newValue}}}',
        },
      ]);
    });

    it('extracts an apk add chained after apk update', () => {
      // https://github.com/elastic/beats/blob/34b0bb23cf59799b731c511eb55d35932d9190c1/metricbeat/module/nats/_meta/Dockerfile#L12
      expect(
        extractApkDeps('RUN apk update && apk add --no-cache curl', escapeChar),
      ).toEqual([
        {
          datasource: 'apk',
          depName: 'curl',
          skipReason: 'unspecified-version',
        },
      ]);
    });

    it('extracts the fuzzy constraints which Wolfi images commonly pin with', () => {
      // https://github.com/elastic/crawler/blob/bc15328fb808affd00dff0cd92527bbe402f5ded/Dockerfile.wolfi#L7
      expect(
        extractApkDeps(
          'RUN apk update && apk add --no-cache libcurl-openssl4=~8.12.1 curl=~8.12.1 make',
          escapeChar,
        ),
      ).toEqual([
        {
          datasource: 'apk',
          depName: 'libcurl-openssl4',
          currentValue: '=~8.12.1',
          replaceString: 'libcurl-openssl4=~8.12.1',
          autoReplaceStringTemplate: 'libcurl-openssl4{{{newValue}}}',
        },
        {
          datasource: 'apk',
          depName: 'curl',
          currentValue: '=~8.12.1',
          replaceString: 'curl=~8.12.1',
          autoReplaceStringTemplate: 'curl{{{newValue}}}',
        },
        {
          datasource: 'apk',
          depName: 'make',
          skipReason: 'unspecified-version',
        },
      ]);
    });

    it('handles a command it cannot tokenize', () => {
      expect(
        extractApkDeps('RUN apk add "bash=5.2.37-r2', escapeChar),
      ).toBeEmpty();
    });
  });
});
