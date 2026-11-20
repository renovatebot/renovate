import { codeBlock } from 'common-tags';
import { fakeSha } from '~test/util.ts';
import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';
import { extractPackageFile } from './index.ts';

describe('modules/manager/haskell-stack/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts git and github extra-deps as commit digests', () => {
      const gitCommit = fakeSha('git');
      const githubCommit = fakeSha('github');
      const content = codeBlock`
        extra-deps:
          - git: https://gitlab.com/org/foo.git
            commit: ${gitCommit}
            subdirs:
              - foo-core
          - github: org/bar
            commit: ${githubCommit}
      `;

      const result = extractPackageFile(content, 'stack.yaml');

      expect(result).toEqual({
        deps: [
          {
            depName: 'org/foo',
            packageName: 'https://gitlab.com/org/foo.git',
            sourceUrl: 'https://gitlab.com/org/foo',
            datasource: GitRefsDatasource.id,
            currentDigest: gitCommit,
            replaceString: gitCommit,
            autoReplaceStringTemplate: '{{{newDigest}}}',
          },
          {
            depName: 'org/bar',
            packageName: 'https://github.com/org/bar',
            sourceUrl: 'https://github.com/org/bar',
            datasource: GitRefsDatasource.id,
            currentDigest: githubCommit,
            replaceString: githubCommit,
            autoReplaceStringTemplate: '{{{newDigest}}}',
          },
        ],
      });
    });

    it.each`
      git                                              | depName               | sourceUrl
      ${'https://ci:token@github.com/org/private.git'} | ${'org/private'}      | ${'https://github.com/org/private'}
      ${'git@github.com:org/repo.git'}                 | ${'org/repo'}         | ${'https://github.com/org/repo'}
      ${'../vendor/repo'}                              | ${'../vendor/repo'}   | ${undefined}
      ${'file:///srv/repo'}                            | ${'file:///srv/repo'} | ${undefined}
    `(
      'names the git extra-dep $git as $depName',
      ({ git, depName, sourceUrl }) => {
        const commit = fakeSha(git);
        const content = codeBlock`
          extra-deps:
            - git: ${git}
              commit: ${commit}
        `;

        const result = extractPackageFile(content, 'stack.yaml');

        expect(result).toEqual({
          deps: [
            {
              depName,
              packageName: git,
              sourceUrl,
              datasource: GitRefsDatasource.id,
              currentDigest: commit,
              replaceString: commit,
              autoReplaceStringTemplate: '{{{newDigest}}}',
            },
          ],
        });
      },
    );

    it('accepts an uppercase commit sha and replaces it as written', () => {
      const commit = fakeSha('upper');
      const content = codeBlock`
        extra-deps:
          - github: org/bar
            commit: ${commit.toUpperCase()}
      `;

      const result = extractPackageFile(content, 'stack.yaml');

      expect(result).toEqual({
        deps: [
          {
            depName: 'org/bar',
            packageName: 'https://github.com/org/bar',
            sourceUrl: 'https://github.com/org/bar',
            datasource: GitRefsDatasource.id,
            currentDigest: commit,
            replaceString: commit.toUpperCase(),
            autoReplaceStringTemplate: '{{{newDigest}}}',
          },
        ],
      });
    });

    it.each`
      source                                   | packageName                         | commit       | skipReason
      ${'github: org/bar'}                     | ${'https://github.com/org/bar'}     | ${'b562aa3'} | ${'unversioned-reference'}
      ${'github: org/bar'}                     | ${'https://github.com/org/bar'}     | ${'v1.0.0'}  | ${'unversioned-reference'}
      ${'git: https://github.com/org/bar.git'} | ${'https://github.com/org/bar.git'} | ${'v1.0.0'}  | ${'unversioned-reference'}
    `(
      'skips $source pinned to $commit as $skipReason',
      ({ source, packageName, commit, skipReason }) => {
        const content = codeBlock`
          extra-deps:
            - ${source}
              commit: ${commit}
        `;

        const result = extractPackageFile(content, 'stack.yaml');

        expect(result).toEqual({
          deps: [
            {
              depName: 'org/bar',
              packageName,
              sourceUrl: 'https://github.com/org/bar',
              datasource: GitRefsDatasource.id,
              currentDigest: commit,
              replaceString: commit,
              autoReplaceStringTemplate: '{{{newDigest}}}',
              skipReason,
            },
          ],
        });
      },
    );

    it('lists extra-deps from unsupported sources with a skip reason', () => {
      const content = codeBlock`
        extra-deps:
          - acme-missiles-0.3
          - text-show-3.10.4@rev:1
          - ./vendor/foo
          - vendor/bar
          - https://example.com/baz-1.0.tar.gz
          - vendored
          - foo-1.0.tar.gz
          - hg: https://example.com/qux
            commit: abc
          - url: https://example.com/quux-1.0.tar.gz
          - location: ./legacy
      `;

      const result = extractPackageFile(content, 'stack.yaml');

      expect(result).toEqual({
        deps: [
          {
            depName: 'acme-missiles',
            currentValue: '0.3',
            skipReason: 'unsupported',
          },
          {
            depName: 'text-show',
            currentValue: '3.10.4',
            skipReason: 'unsupported',
          },
          { depName: './vendor/foo', skipReason: 'local-dependency' },
          { depName: 'vendor/bar', skipReason: 'local-dependency' },
          {
            depName: 'https://example.com/baz-1.0.tar.gz',
            skipReason: 'unsupported-url',
          },
          { depName: 'vendored', skipReason: 'local-dependency' },
          { depName: 'foo-1.0.tar.gz', skipReason: 'local-dependency' },
          {
            depName: 'https://example.com/qux',
            skipReason: 'unsupported-remote',
          },
          {
            depName: 'https://example.com/quux-1.0.tar.gz',
            skipReason: 'unsupported-url',
          },
        ],
      });
    });

    it.each`
      description                  | content
      ${'without extra-deps'}      | ${'resolver: lts-22.0\npackages:\n  - .\n'}
      ${'for an empty extra-deps'} | ${'resolver: lts-22.0\nextra-deps:\n'}
      ${'for invalid yaml'}        | ${'extra-deps: ['}
    `('returns null $description', ({ content }) => {
      expect(extractPackageFile(content, 'stack.yaml')).toBeNull();
    });
  });
});
