import { DateTime } from 'luxon';
import { Fixtures } from '~test/fixtures.ts';
import { hostRules } from '~test/host-rules.ts';
import * as httpMock from '~test/http-mock.ts';
import { partial } from '~test/util.ts';
import * as packageCache from '../../../../../util/cache/package/index.ts';
import { clone } from '../../../../../util/clone.ts';
import * as githubGraphql from '../../../../../util/github/graphql/index.ts';
import type { GithubReleaseItem } from '../../../../../util/github/graphql/types.ts';
import { toBase64 } from '../../../../../util/string.ts';
import type { Timestamp } from '../../../../../util/timestamp.ts';
import type { BranchUpgradeConfig } from '../../../../types.ts';
import {
  addReleaseNotes,
  getReleaseList,
  getReleaseNotes,
  getReleaseNotesMd,
  massageBody,
  releaseNotesCacheMinutes,
  shouldSkipChangelogMd,
} from './release-notes.ts';
import type {
  ChangeLogNotes,
  ChangeLogProject,
  ChangeLogRelease,
  ChangeLogResult,
} from './types.ts';

const angularJsChangelogMd = Fixtures.get('angular-js.md');
const jestChangelogMd = Fixtures.get('jest.md');
const jsYamlChangelogMd = Fixtures.get('js-yaml.md');
const yargsChangelogMd = Fixtures.get('yargs.md');
const adapterutilsChangelogMd = Fixtures.get('adapter-utils.md');
const gitterWebappChangelogMd = Fixtures.get('gitter-webapp.md');
const releasePlanChangelogMd = `
# release-plan Changelog

## Release (2025-03-13)

* release-plan 0.16.0 (minor)

#### :rocket: Enhancement
* \`release-plan\`
  * [#155](https://github.com/embroider-build/release-plan/pull/155) add ability to set tag per package

## Release (2025-03-03)

* release-plan 0.15.0 (minor)

#### :rocket: Enhancement
* \`release-plan\`
  * [#158](https://github.com/embroider-build/release-plan/pull/158) feat: Display new package versions as list

#### :house: Internal
* \`release-plan\`
  * [#153](https://github.com/embroider-build/release-plan/pull/153) move publish test to mock execa

## Release (2025-03-03)

release-plan 0.14.0 (minor)

#### :rocket: Enhancement
* \`release-plan\`
  * [#131](https://github.com/embroider-build/release-plan/pull/131) add skip npm option
  * [#133](https://github.com/embroider-build/release-plan/pull/133) update execa
  * [#124](https://github.com/embroider-build/release-plan/pull/124) support github enterprise api url via env var

#### :bug: Bug Fix
* \`release-plan\`
  * [#138](https://github.com/embroider-build/release-plan/pull/138) fix readJSONSync import
  * [#107](https://github.com/embroider-build/release-plan/pull/107) Bump chalk from 4.1.2 to 5.4.1

#### :memo: Documentation
* \`release-plan\`
  * [#141](https://github.com/embroider-build/release-plan/pull/141) Add note about creating initial tag

#### :house: Internal
* \`release-plan\`
  * [#146](https://github.com/embroider-build/release-plan/pull/146) add extra test coverage to plan
  * [#152](https://github.com/embroider-build/release-plan/pull/152) remove conditional coverage run
`;

const keepAChangelogMd = `# Changelog

## [Unreleased]

- Enhance security when \`dry-run\` is true.

## [1.30.1] - 2026-04-17

- Enhance security against supply chain attacks.

## [1.0.0] - 2021-02-03

Initial release

[Unreleased]: https://github.com/taiki-e/upload-rust-binary-action/compare/v1.30.2...HEAD
[1.30.2]: https://github.com/taiki-e/upload-rust-binary-action/compare/v1.30.1...v1.30.2
[1.30.1]: https://github.com/taiki-e/upload-rust-binary-action/compare/v1.30.0...v1.30.1
[1.0.0]: https://github.com/taiki-e/upload-rust-binary-action/releases/tag/v1.0.0
`;

const bitbucketTreeResponse = {
  values: [
    {
      type: 'commit_directory',
      path: 'lib',
      commit: {
        hash: '1234',
      },
    },
    {
      type: 'commit_file',
      path: 'CHANGELOG',
      commit: {
        hash: 'cdef',
      },
    },
    {
      type: 'commit_file',
      path: 'CHANGELOG.json',
      commit: {
        hash: 'defg',
      },
    },
    {
      type: 'commit_file',
      path: 'CHANGELOG.md',
      commit: {
        hash: 'abcd',
      },
    },
    {
      type: 'commit_file',
      path: 'RELEASE_NOTES.md',
      commit: {
        hash: 'asdf',
      },
    },
  ],
};

const githubTreeResponse = {
  tree: [
    { path: 'lib', type: 'tree' },
    { path: 'CHANGELOG', type: 'blob', sha: 'cdef' },
    { path: 'CHANGELOG.json', type: 'blob', sha: 'bcde' },
    { path: 'CHANGELOG.md', type: 'blob', sha: 'abcd' },
    { path: 'README.md', type: 'blob' },
  ],
};

const gitlabTreeResponse = [
  { path: 'lib', name: 'lib', type: 'tree' },
  { path: 'CHANGELOG', name: 'CHANGELOG', type: 'blob', id: 'cdef' },
  { path: 'CHANGELOG.json', name: 'CHANGELOG.json', type: 'blob', id: 'bcde' },
  { path: 'CHANGELOG.md', name: 'CHANGELOG.md', type: 'blob', id: 'abcd' },
  { path: 'README.md', name: 'README.md', type: 'blob' },
];

const bitbucketProject = partial<ChangeLogProject>({
  type: 'bitbucket',
  apiBaseUrl: 'https://api.bitbucket.org/',
  baseUrl: 'https://bitbucket.org/',
});

const bitbucketServerProject = partial<ChangeLogProject>({
  type: 'bitbucket-server',
  apiBaseUrl: 'https://bitbucket.domain.org/rest/api/1.0/',
  baseUrl: 'https://bitbucket\\.domain.org/',
});

const githubProject = partial<ChangeLogProject>({
  type: 'github',
  apiBaseUrl: 'https://api.github.com/',
  baseUrl: 'https://github.com/',
});

const gitlabProject = partial<ChangeLogProject>({
  type: 'gitlab',
  apiBaseUrl: 'https://gitlab.com/api/v4/',
  baseUrl: 'https://gitlab.com/',
});

describe('workers/repository/update/pr/changelog/release-notes', () => {
  const githubReleasesMock = vi.spyOn(githubGraphql, 'queryReleases');

  describe('releaseNotesCacheMinutes', () => {
    const now = DateTime.local();

    it.each([
      [now, 55],
      [now.minus({ weeks: 2 }), 1435],
      [now.minus({ years: 1 }), 14495],
    ])('works with string date (%s, %i)', (date, minutes) => {
      expect(releaseNotesCacheMinutes(date.toISO())).toEqual(minutes);
    });

    it('handles date object', () => {
      expect(releaseNotesCacheMinutes(new Date())).toBe(55);
    });

    it.each([null, undefined, 'fake', 123])('handles invalid: %s', (date) => {
      expect(releaseNotesCacheMinutes(date as never)).toBe(55);
    });
  });

  describe('addReleaseNotes()', () => {
    it('returns null if input is null/undefined', async () => {
      expect(
        await addReleaseNotes(null, partial<BranchUpgradeConfig>()),
      ).toBeNull();
      expect(
        await addReleaseNotes(undefined, partial<BranchUpgradeConfig>()),
      ).toBeNull();
    });

    it('returns input if invalid', async () => {
      const input = { a: 1 };
      expect(
        await addReleaseNotes(input as never, partial<BranchUpgradeConfig>()),
      ).toEqual(input);
      expect(
        await addReleaseNotes(null, partial<BranchUpgradeConfig>()),
      ).toBeNull();
      expect(
        await addReleaseNotes({ versions: [] }, partial<BranchUpgradeConfig>()),
      ).toStrictEqual({ versions: [] });
    });

    it('returns ChangeLogResult', async () => {
      const input = {
        project: {
          type: 'github',
          repository: 'https://github.com/nodeca/js-yaml',
        },
        versions: [{ version: '3.10.0', compare: { url: '' } }],
      };
      expect(
        await addReleaseNotes(input as never, partial<BranchUpgradeConfig>()),
      ).toEqual({
        hasReleaseNotes: false,
        project: {
          repository: 'https://github.com/nodeca/js-yaml',
          type: 'github',
        },
        versions: [
          {
            compare: {
              url: '',
            },
            releaseNotes: null,
            version: '3.10.0',
          },
        ],
      });
    });

    it('uses gitRef in cache key', async () => {
      githubReleasesMock.mockResolvedValue([
        {
          id: 123,
          version: 'custom-a/1.0.0',
          releaseTimestamp: '2020-01-01' as Timestamp,
          url: 'https://example.com/custom-a',
          description: 'release a',
          name: 'release-a',
        },
        {
          id: 456,
          version: 'custom-b/1.0.0',
          releaseTimestamp: '2020-01-01' as Timestamp,
          url: 'https://example.com/custom-b',
          description: 'release b',
          name: 'release-b',
        },
      ]);

      const firstInput = {
        project: partial<ChangeLogProject>({
          type: 'github',
          repository: 'facebook/react-native',
          packageName: 'unrelated-package',
          apiBaseUrl: 'https://api.github.com/',
          baseUrl: 'https://github.com/',
        }),
        versions: [
          partial<ChangeLogRelease>({
            version: '1.0.0',
            gitRef: 'custom-a/1.0.0',
            compare: { url: '' },
          }),
        ],
      } satisfies ChangeLogResult;

      const secondInput = {
        project: partial<ChangeLogProject>({
          type: 'github',
          repository: 'facebook/react-native',
          packageName: 'unrelated-package',
          apiBaseUrl: 'https://api.github.com/',
          baseUrl: 'https://github.com/',
        }),
        versions: [
          partial<ChangeLogRelease>({
            version: '1.0.0',
            gitRef: 'custom-b/1.0.0',
            compare: { url: '' },
          }),
        ],
      } satisfies ChangeLogResult;

      const firstRes = await addReleaseNotes(
        firstInput,
        partial<BranchUpgradeConfig>(),
      );
      const secondRes = await addReleaseNotes(
        secondInput,
        partial<BranchUpgradeConfig>(),
      );

      expect(firstRes?.versions?.[0]?.releaseNotes?.url).toBe(
        'https://example.com/custom-a',
      );
      expect(secondRes?.versions?.[0]?.releaseNotes?.url).toBe(
        'https://example.com/custom-b',
      );
    });

    it('uses legacy cache key when gitRef is not set', async () => {
      const packageCacheGetSpy = vi.spyOn(packageCache, 'get');
      githubReleasesMock.mockResolvedValueOnce([
        {
          id: 123,
          version: 'v1.0.0',
          releaseTimestamp: '2020-01-01' as Timestamp,
          url: 'https://example.com/v1.0.0',
          description: 'release',
          name: 'release',
        },
      ]);

      const input = {
        project: partial<ChangeLogProject>({
          type: 'github',
          repository: 'facebook/react-native',
          packageName: 'unrelated-package',
          apiBaseUrl: 'https://api.github.com/',
          baseUrl: 'https://github.com/',
        }),
        versions: [
          partial<ChangeLogRelease>({
            version: '1.0.0',
            compare: { url: '' },
          }),
        ],
      } satisfies ChangeLogResult;

      await addReleaseNotes(input, partial<BranchUpgradeConfig>());

      expect(packageCacheGetSpy).toHaveBeenCalledWith(
        'changelog-github-notes@v2',
        'facebook/react-native:1.0.0',
      );
    });

    it('includes sourceDirectory and gitRef in cache key', async () => {
      const packageCacheGetSpy = vi.spyOn(packageCache, 'get');
      githubReleasesMock.mockResolvedValueOnce([
        {
          id: 123,
          version: 'custom-a/1.0.0',
          releaseTimestamp: '2020-01-01' as Timestamp,
          url: 'https://example.com/custom-a',
          description: 'release a',
          name: 'release-a',
        },
      ]);

      const input = {
        project: partial<ChangeLogProject>({
          type: 'github',
          repository: 'facebook/react-native',
          sourceDirectory: 'packages/core',
          packageName: 'unrelated-package',
          apiBaseUrl: 'https://api.github.com/',
          baseUrl: 'https://github.com/',
        }),
        versions: [
          partial<ChangeLogRelease>({
            version: '1.0.0',
            gitRef: 'custom-a/1.0.0',
            compare: { url: '' },
          }),
        ],
      } satisfies ChangeLogResult;

      await addReleaseNotes(input, partial<BranchUpgradeConfig>());

      expect(packageCacheGetSpy).toHaveBeenCalledWith(
        'changelog-github-notes@v2',
        'facebook/react-native:packages/core:1.0.0:custom-a/1.0.0',
      );
    });

    it('matches release notes using gitRef when the tag differs from the version', async () => {
      githubReleasesMock.mockResolvedValueOnce([
        {
          id: 123,
          version: 'random-prefix-1.0.1',
          releaseTimestamp: '2020-01-01' as Timestamp,
          url: 'https://example.com/wrong',
          description: 'wrong body',
          name: 'some/dep',
        },
        {
          id: 456,
          version: 'my-custom-tag/1.0.1',
          releaseTimestamp: '2020-01-01' as Timestamp,
          url: 'https://example.com/correct',
          description: 'correct body',
          name: 'some/dep',
        },
      ]);

      const res = await getReleaseNotes(
        {
          ...githubProject,
          repository: 'some/other-repository',
          packageName: 'exampleDep',
        },
        partial<ChangeLogRelease>({
          version: '1.0.1',
          gitRef: 'my-custom-tag/1.0.1',
        }),
        partial<BranchUpgradeConfig>(),
      );

      expect(res).toEqual({
        url: 'https://example.com/correct',
        notesSourceUrl:
          'https://api.github.com/repos/some/other-repository/releases',
        id: 456,
        tag: 'my-custom-tag/1.0.1',
        name: 'some/dep',
        body: 'correct body\n',
      });
    });

    it('returns ChangeLogResult without release notes', async () => {
      httpMock
        .scope(
          'https://gitlab.com/api/v4/projects/gitlab-org%2Fgitter%2Fwebapp',
        )
        .get('/repository/tree?per_page=100&path=lib')
        .reply(200, [])
        .get('/releases?per_page=100')
        .reply(200, []);
      const input = {
        project: partial<ChangeLogProject>({
          type: 'gitlab',
          repository: 'gitlab-org/gitter/webapp',
          sourceDirectory: 'lib',
          apiBaseUrl: 'https://gitlab.com/api/v4/',
          baseUrl: 'https://gitlab.com/',
        }),
        versions: [
          partial<ChangeLogRelease>({
            version: '20.26.0',
            compare: { url: '' },
          }),
        ],
      } satisfies ChangeLogResult;
      expect(
        await addReleaseNotes(input, partial<BranchUpgradeConfig>()),
      ).toEqual({
        hasReleaseNotes: false,
        project: {
          repository: 'gitlab-org/gitter/webapp',
          type: 'gitlab',
          sourceDirectory: 'lib',
          apiBaseUrl: 'https://gitlab.com/api/v4/',
          baseUrl: 'https://gitlab.com/',
        },
        versions: [
          {
            compare: {
              url: '',
            },
            releaseNotes: null,
            version: '20.26.0',
          },
        ],
      });
    });
  });

  describe('getReleaseList()', () => {
    it('should return empty array if no apiBaseUrl', async () => {
      const res = await getReleaseList(
        partial<ChangeLogProject>(),
        partial<ChangeLogRelease>(),
      );
      expect(res).toBeEmptyArray();
    });

    it('should return release list for github repo', async () => {
      githubReleasesMock.mockResolvedValueOnce([
        {
          version: `v1.0.0`,
          releaseTimestamp: '2020-01-01' as Timestamp,
          id: 1,
          url: 'https://example.com',
          name: 'some/dep',
          description: 'some body',
        },
        {
          version: `v1.0.1`,
          releaseTimestamp: '2020-01-01' as Timestamp,
          id: 1,
          url: 'https://example.com',
          name: 'some/dep',
          description:
            'some body #123, [#124](https://github.com/some/yet-other-repository/issues/124)',
        },
      ]);
      const res = await getReleaseList(
        {
          ...githubProject,
          repository: 'some/yet-other-repository',
        },
        partial<ChangeLogRelease>(),
      );
      expect(res).toMatchObject([
        {
          notesSourceUrl:
            'https://api.github.com/repos/some/yet-other-repository/releases',
          tag: 'v1.0.0',
        },
        {
          body: 'some body #123, [#124](https://github.com/some/yet-other-repository/issues/124)',
          notesSourceUrl:
            'https://api.github.com/repos/some/yet-other-repository/releases',
          tag: 'v1.0.1',
        },
      ]);
    });

    it('should return release list for gitlab.com project', async () => {
      httpMock
        .scope('https://gitlab.com/')
        .get(
          '/api/v4/projects/some%2Fyet-other-repository/releases?per_page=100',
        )
        .reply(200, [
          { tag_name: `v1.0.0` },
          {
            tag_name: `v1.0.1`,
            body: 'some body #123, [#124](https://gitlab.com/some/yet-other-repository/issues/124)',
          },
        ]);
      const res = await getReleaseList(
        {
          ...gitlabProject,
          repository: 'some/yet-other-repository',
        },
        partial<ChangeLogRelease>(),
      );
      expect(res).toMatchObject([
        {
          notesSourceUrl:
            'https://gitlab.com/api/v4/projects/some%2Fyet-other-repository/releases',
          tag: 'v1.0.0',
          url: 'https://gitlab.com/some/yet-other-repository/-/releases/v1.0.0',
        },
        {
          notesSourceUrl:
            'https://gitlab.com/api/v4/projects/some%2Fyet-other-repository/releases',
          tag: 'v1.0.1',
          url: 'https://gitlab.com/some/yet-other-repository/-/releases/v1.0.1',
        },
      ]);
    });

    it('should return release list for self hosted gitlab project', async () => {
      hostRules.add({ token: 'some-token' });
      httpMock
        .scope('https://my.custom.domain/')
        .get(
          '/api/v4/projects/some%2Fyet-other-repository/releases?per_page=100',
        )
        .reply(200, [
          { tag_name: `v1.0.0` },
          {
            tag_name: `v1.0.1`,
            body: 'some body #123, [#124](https://my.custom.domain/some/yet-other-repository/issues/124)',
          },
        ]);
      const res = await getReleaseList(
        {
          ...gitlabProject,
          repository: 'some/yet-other-repository',
          apiBaseUrl: 'https://my.custom.domain/api/v4/',
          baseUrl: 'https://my.custom.domain/',
        },
        partial<ChangeLogRelease>(),
      );
      expect(res).toMatchObject([
        {
          notesSourceUrl:
            'https://my.custom.domain/api/v4/projects/some%2Fyet-other-repository/releases',
          tag: 'v1.0.0',
          url: 'https://my.custom.domain/some/yet-other-repository/-/releases/v1.0.0',
        },
        {
          notesSourceUrl:
            'https://my.custom.domain/api/v4/projects/some%2Fyet-other-repository/releases',
          tag: 'v1.0.1',
          url: 'https://my.custom.domain/some/yet-other-repository/-/releases/v1.0.1',
        },
      ]);
    });

    it('should return empty release list for self-hosted bitbucket-server', async () => {
      const res = await getReleaseList(
        {
          ...bitbucketServerProject,
          repository: 'some/yet-other-repository',
        },
        partial<ChangeLogRelease>(),
      );
      expect(res).toBeEmptyArray();
    });
  });

  describe('getReleaseNotes()', () => {
    it('should return null for release notes without body and name', async () => {
      githubReleasesMock.mockResolvedValueOnce([
        {
          version: '1.0.0',
          releaseTimestamp: '2020-01-01' as Timestamp,
          id: 1,
          url: 'https://github.com/some/other-repository/releases/1.0.0',
          name: '',
          description: '',
        },
        {
          version: '1.0.1',
          releaseTimestamp: '2020-01-01' as Timestamp,
          id: 2,
          url: 'https://github.com/some/other-repository/releases/1.0.1',
          name: '',
          description: '',
        },
      ]);
      const res = await getReleaseNotes(
        {
          ...githubProject,
          repository: 'some/repository',
          packageName: 'some',
        },
        partial<ChangeLogRelease>({
          version: '1.0.0',
          gitRef: '1.0.0',
        }),
        partial<BranchUpgradeConfig>(),
      );
      expect(res).toBeNull();
    });

    it('gets release notes with body ""', async () => {
      githubReleasesMock.mockResolvedValueOnce([
        {
          version: '1.0.0',
          releaseTimestamp: '2020-01-01' as Timestamp,
          id: 1,
          url: 'https://github.com/some/other-repository/releases/1.0.0',
          name: 'some/dep',
          description: 'some body',
        },
        {
          version: '1.0.1',
          releaseTimestamp: '2020-01-01' as Timestamp,
          id: 2,
          url: 'https://github.com/some/other-repository/releases/1.0.1',
          name: 'some/dep',
          description:
            'some body #123, [#124](https://github.com/some/yet-other-repository/issues/124)',
        },
      ]);
      const res = await getReleaseNotes(
        {
          ...githubProject,
          repository: 'some/other-repository',
          packageName: 'other',
        },
        partial<ChangeLogRelease>({
          version: '1.0.1',
          gitRef: '1.0.1',
        }),
        partial<BranchUpgradeConfig>(),
      );
      expect(res).toEqual({
        body: 'some body [#123](https://github.com/some/other-repository/issues/123), [#124](https://github.com/some/yet-other-repository/issues/124)\n',
        id: 2,
        name: 'some/dep',
        notesSourceUrl:
          'https://api.github.com/repos/some/other-repository/releases',
        tag: '1.0.1',
        url: 'https://github.com/some/other-repository/releases/1.0.1',
      });
    });

    it('gets release notes with name ""', async () => {
      githubReleasesMock.mockResolvedValueOnce([
        {
          version: '1.0.0',
          releaseTimestamp: '2020-01-01' as Timestamp,
          id: 1,
          url: 'https://github.com/some/other-repository/releases/1.0.0',
          name: 'some/dep',
          description: '',
        },
        {
          version: '1.0.1',
          releaseTimestamp: '2020-01-01' as Timestamp,
          id: 2,
          url: 'https://github.com/some/other-repository/releases/1.0.1',
          name: 'some release name',
          description: '',
        },
      ]);
      const res = await getReleaseNotes(
        {
          ...githubProject,
          repository: 'some/other-repository',
          packageName: 'other',
        },
        partial<ChangeLogRelease>({
          version: '1.0.1',
          gitRef: '1.0.1',
        }),
        partial<BranchUpgradeConfig>(),
      );
      expect(res).toEqual({
        body: '',
        id: 2,
        name: 'some release name',
        notesSourceUrl:
          'https://api.github.com/repos/some/other-repository/releases',
        tag: '1.0.1',
        url: 'https://github.com/some/other-repository/releases/1.0.1',
      });
    });

    it('filters release note name when same as version', async () => {
      githubReleasesMock.mockResolvedValueOnce([
        {
          version: '1.0.0',
          releaseTimestamp: '2020-01-01' as Timestamp,
          id: 1,
          url: 'https://github.com/some/other-repository/releases/1.0.0',
          name: 'Release v1.0.0',
          description: 'some body',
        },
        {
          version: '1.0.1',
          releaseTimestamp: '2020-01-01' as Timestamp,
          id: 2,
          url: 'https://github.com/some/other-repository/releases/1.0.1',
          name: '1.0.1',
          description: 'some body',
        },
      ]);
      const res = await getReleaseNotes(
        {
          ...githubProject,
          repository: 'some/other-repository',
          packageName: 'other',
        },
        partial<ChangeLogRelease>({
          version: '1.0.1',
          gitRef: '1.0.1',
        }),
        partial<BranchUpgradeConfig>(),
      );
      expect(res).toEqual({
        body: 'some body\n',
        id: 2,
        name: undefined,
        notesSourceUrl:
          'https://api.github.com/repos/some/other-repository/releases',
        tag: '1.0.1',
        url: 'https://github.com/some/other-repository/releases/1.0.1',
      });
    });

    it('strips release note with version prefixed name', async () => {
      githubReleasesMock.mockResolvedValueOnce([
        {
          version: '1.0.0',
          releaseTimestamp: '2020-01-01' as Timestamp,
          id: 1,
          url: 'https://github.com/some/other-repository/releases/1.0.1',
          name: 'some/dep',
          description: 'some body',
        },
        {
          version: '1.0.1',
          releaseTimestamp: '2020-01-01' as Timestamp,
          id: 2,
          url: 'https://github.com/some/other-repository/releases/1.0.1',
          name: 'v1.0.1 some release',
          description: 'some body',
        },
      ]);
      const res = await getReleaseNotes(
        {
          ...githubProject,
          repository: 'some/other-repository',
          packageName: 'other',
        },
        partial<ChangeLogRelease>({
          version: '1.0.1',
          gitRef: '1.0.1',
        }),
        partial<BranchUpgradeConfig>(),
      );
      expect(res).toEqual({
        body: 'some body\n',
        id: 2,
        name: 'some release',
        notesSourceUrl:
          'https://api.github.com/repos/some/other-repository/releases',
        tag: '1.0.1',
        url: 'https://github.com/some/other-repository/releases/1.0.1',
      });
    });

    it('release notes without body and name that matches version tag returns null', async () => {
      githubReleasesMock.mockResolvedValueOnce([
        {
          version: '1.0.0',
          releaseTimestamp: '2020-01-01' as Timestamp,
          id: 1,
          url: 'correct/url/tag.com',
          name: 'some/dep',
          description: '',
        },
        {
          version: '1.0.1',
          releaseTimestamp: '2020-01-01' as Timestamp,
          id: 2,
          url: 'correct/url/tag.com',
          name: '1.0.1',
          description: '',
        },
      ]);
      const res = await getReleaseNotes(
        {
          ...githubProject,
          repository: 'some/other-repository',
          packageName: 'other',
        },
        partial<ChangeLogRelease>({
          version: '1.0.1',
          gitRef: '1.0.1',
        }),
        partial<BranchUpgradeConfig>(),
      );
      expect(res).toBeNull();
    });

    it('gets release notes with body "v"', async () => {
      githubReleasesMock.mockResolvedValueOnce([
        {
          version: 'v1.0.0',
          releaseTimestamp: '2020-01-01' as Timestamp,
          id: 1,
          url: 'https://github.com/some/other-repository/releases/v1.0.0',
          name: 'some/dep',
          description: 'some body',
        },
        {
          version: 'v1.0.1',
          releaseTimestamp: '2020-01-01' as Timestamp,
          id: 2,
          url: 'https://github.com/some/other-repository/releases/v1.0.1',
          name: 'some/dep',
          description:
            'some body #123, [#124](https://github.com/some/yet-other-repository/issues/124)',
        },
      ]);
      const res = await getReleaseNotes(
        {
          ...githubProject,
          repository: 'some/other-repository',
          packageName: 'other',
        },
        partial<ChangeLogRelease>({
          version: '1.0.1',
          gitRef: '1.0.1',
        }),
        partial<BranchUpgradeConfig>(),
      );
      expect(res).toEqual({
        body: 'some body [#123](https://github.com/some/other-repository/issues/123), [#124](https://github.com/some/yet-other-repository/issues/124)\n',
        id: 2,
        name: 'some/dep',
        notesSourceUrl:
          'https://api.github.com/repos/some/other-repository/releases',
        tag: 'v1.0.1',
        url: 'https://github.com/some/other-repository/releases/v1.0.1',
      });
    });

    it('gets release notes with body "other-" (packageName)', async () => {
      githubReleasesMock.mockResolvedValueOnce([
        {
          version: 'other-1.0.0',
          releaseTimestamp: '2020-01-01' as Timestamp,
          id: 1,
          url: 'https://github.com/some/other-repository/releases/other-1.0.0',
          name: 'some/dep',
          description: 'some body',
        },
        {
          version: 'other-1.0.1',
          releaseTimestamp: '2020-01-01' as Timestamp,
          id: 2,
          url: 'https://github.com/some/other-repository/releases/other-1.0.1',
          name: 'some/dep',
          description:
            'some body #123, [#124](https://github.com/some/yet-other-repository/issues/124)',
        },
      ]);

      const res = await getReleaseNotes(
        {
          ...githubProject,
          repository: 'some/other-repository',
          packageName: 'other',
        },
        partial<ChangeLogRelease>({
          version: '1.0.1',
          gitRef: '1.0.1',
        }),
        partial<BranchUpgradeConfig>(),
      );
      expect(res).toEqual({
        body: 'some body [#123](https://github.com/some/other-repository/issues/123), [#124](https://github.com/some/yet-other-repository/issues/124)\n',
        id: 2,
        name: 'some/dep',
        notesSourceUrl:
          'https://api.github.com/repos/some/other-repository/releases',
        tag: 'other-1.0.1',
        url: 'https://github.com/some/other-repository/releases/other-1.0.1',
      });
    });

    it('gets release notes with body "other-" (depName)', async () => {
      githubReleasesMock.mockResolvedValueOnce([
        {
          version: 'other-1.0.0',
          releaseTimestamp: '2020-01-01' as Timestamp,
          id: 1,
          url: 'https://github.com/some/other-repository/releases/other-1.0.0',
          name: 'some/dep',
          description: 'some body',
        },
        {
          version: 'other-1.0.1',
          releaseTimestamp: '2020-01-01' as Timestamp,
          id: 2,
          url: 'https://github.com/some/other-repository/releases/other-1.0.1',
          name: 'some/dep',
          description:
            'some body #123, [#124](https://github.com/some/yet-other-repository/issues/124)',
        },
      ]);

      const res = await getReleaseNotes(
        {
          ...githubProject,
          repository: 'some/other-repository',
          packageName: 'some.registry/some/other',
          depName: 'other',
        },
        partial<ChangeLogRelease>({
          version: '1.0.1',
          gitRef: '1.0.1',
        }),
        partial<BranchUpgradeConfig>(),
      );
      expect(res).toEqual({
        body: 'some body [#123](https://github.com/some/other-repository/issues/123), [#124](https://github.com/some/yet-other-repository/issues/124)\n',
        id: 2,
        name: 'some/dep',
        notesSourceUrl:
          'https://api.github.com/repos/some/other-repository/releases',
        tag: 'other-1.0.1',
        url: 'https://github.com/some/other-repository/releases/other-1.0.1',
      });
    });

    it('gets release notes with body "other_v"', async () => {
      githubReleasesMock.mockResolvedValueOnce([
        {
          version: 'other_v1.0.0',
          releaseTimestamp: '2020-01-01' as Timestamp,
          id: 1,
          url: 'https://github.com/some/other-repository/releases/other_v1.0.0',
          name: 'some/dep',
          description: 'some body',
        },
        {
          version: 'other_v1.0.1',
          releaseTimestamp: '2020-01-01' as Timestamp,
          id: 2,
          url: 'https://github.com/some/other-repository/releases/other_v1.0.1',
          name: 'some/dep',
          description:
            'some body #123, [#124](https://github.com/some/yet-other-repository/issues/124)',
        },
      ]);

      const res = await getReleaseNotes(
        {
          ...githubProject,
          repository: 'some/other-repository',
          packageName: 'other',
        },
        partial<ChangeLogRelease>({
          version: '1.0.1',
          gitRef: '1.0.1',
        }),
        partial<BranchUpgradeConfig>(),
      );
      expect(res).toEqual({
        body: 'some body [#123](https://github.com/some/other-repository/issues/123), [#124](https://github.com/some/yet-other-repository/issues/124)\n',
        id: 2,
        name: 'some/dep',
        notesSourceUrl:
          'https://api.github.com/repos/some/other-repository/releases',
        tag: 'other_v1.0.1',
        url: 'https://github.com/some/other-repository/releases/other_v1.0.1',
      });
    });

    it('gets release notes with body "other@"', async () => {
      githubReleasesMock.mockResolvedValueOnce([
        {
          version: 'other@1.0.0',
          id: 1,
          releaseTimestamp: '2020-01-01' as Timestamp,
          url: 'https://github.com/some/other-repository/releases/other@1.0.0',
          name: 'some/dep',
          description: 'some body',
        },
        {
          version: 'other@1.0.1',
          description:
            'some body #123, [#124](https://github.com/some/yet-other-repository/issues/124)',
          id: 2,
          releaseTimestamp: '2020-01-01' as Timestamp,
          url: 'https://github.com/some/other-repository/releases/other@1.0.1',
          name: 'some/dep',
        },
      ] satisfies GithubReleaseItem[]);
      const res = await getReleaseNotes(
        {
          ...githubProject,
          repository: 'some/other-repository',
          packageName: 'other',
        },
        partial<ChangeLogRelease>({
          version: '1.0.1',
          gitRef: '1.0.1',
        }),
        partial<BranchUpgradeConfig>(),
      );
      expect(res).toEqual({
        body: 'some body [#123](https://github.com/some/other-repository/issues/123), [#124](https://github.com/some/yet-other-repository/issues/124)\n',
        id: 2,
        name: 'some/dep',
        notesSourceUrl:
          'https://api.github.com/repos/some/other-repository/releases',
        tag: 'other@1.0.1',
        url: 'https://github.com/some/other-repository/releases/other@1.0.1',
      });
    });

    it('gets release notes with body "other/"', async () => {
      githubReleasesMock.mockResolvedValueOnce([
        {
          version: 'other/1.0.0',
          id: 1,
          releaseTimestamp: '2020-01-01' as Timestamp,
          url: 'https://github.com/some/other-repository/releases/other/1.0.0',
          name: 'some/dep',
          description: 'some body',
        },
        {
          version: 'other/1.0.1',
          description:
            'some body #123, [#124](https://github.com/some/yet-other-repository/issues/124)',
          id: 2,
          releaseTimestamp: '2020-01-01' as Timestamp,
          url: 'https://github.com/some/other-repository/releases/other/1.0.1',
          name: 'some/dep',
        },
      ] satisfies GithubReleaseItem[]);
      const res = await getReleaseNotes(
        {
          ...githubProject,
          repository: 'some/other-repository',
          packageName: 'other',
        },
        partial<ChangeLogRelease>({
          version: '1.0.1',
          gitRef: '1.0.1',
        }),
        partial<BranchUpgradeConfig>(),
      );
      expect(res).toEqual({
        body: 'some body [#123](https://github.com/some/other-repository/issues/123), [#124](https://github.com/some/yet-other-repository/issues/124)\n',
        id: 2,
        name: 'some/dep',
        notesSourceUrl:
          'https://api.github.com/repos/some/other-repository/releases',
        tag: 'other/1.0.1',
        url: 'https://github.com/some/other-repository/releases/other/1.0.1',
      });
    });

    it('gets release notes with body "other/v"', async () => {
      githubReleasesMock.mockResolvedValueOnce([
        {
          version: 'other/v1.0.0',
          id: 1,
          releaseTimestamp: '2020-01-01' as Timestamp,
          url: 'https://github.com/some/other-repository/releases/other/v1.0.0',
          name: 'some/dep',
          description: 'some body',
        },
        {
          version: 'other/v1.0.1',
          description:
            'some body #123, [#124](https://github.com/some/yet-other-repository/issues/124)',
          id: 2,
          releaseTimestamp: '2020-01-01' as Timestamp,
          url: 'https://github.com/some/other-repository/releases/other/v1.0.1',
          name: 'some/dep',
        },
      ] satisfies GithubReleaseItem[]);
      const res = await getReleaseNotes(
        {
          ...githubProject,
          repository: 'some/other-repository',
          packageName: 'other',
        },
        partial<ChangeLogRelease>({
          version: '1.0.1',
          gitRef: '1.0.1',
        }),
        partial<BranchUpgradeConfig>(),
      );
      expect(res).toEqual({
        body: 'some body [#123](https://github.com/some/other-repository/issues/123), [#124](https://github.com/some/yet-other-repository/issues/124)\n',
        id: 2,
        name: 'some/dep',
        notesSourceUrl:
          'https://api.github.com/repos/some/other-repository/releases',
        tag: 'other/v1.0.1',
        url: 'https://github.com/some/other-repository/releases/other/v1.0.1',
      });
    });

    it('gets release notes with body from gitlab repo ""', async () => {
      const prefix = '';
      httpMock
        .scope('https://api.gitlab.com/')
        .get('/projects/some%2Fother-repository/releases?per_page=100')
        .reply(200, [
          { tag_name: `${prefix}1.0.0` },
          {
            tag_name: `${prefix}1.0.1`,
            description:
              'some body #123, [#124](https://gitlab.com/some/yet-other-repository/issues/124)',
          },
        ]);

      const res = await getReleaseNotes(
        {
          ...gitlabProject,
          repository: 'some/other-repository',
          packageName: 'other',
          apiBaseUrl: 'https://api.gitlab.com/',
        },
        partial<ChangeLogRelease>({
          version: '1.0.1',
          gitRef: '1.0.1',
        }),
        partial<BranchUpgradeConfig>(),
      );
      expect(res).toEqual({
        body: 'some body #123, [#124](https://gitlab.com/some/yet-other-repository/issues/124)',
        name: undefined,
        notesSourceUrl:
          'https://api.gitlab.com/projects/some%2Fother-repository/releases',
        tag: '1.0.1',
        url: 'https://gitlab.com/some/other-repository/tags/1.0.1',
      });
    });

    it('gets release notes with body from gitlab repo "v"', async () => {
      const prefix = 'v';
      httpMock
        .scope('https://api.gitlab.com/')
        .get('/projects/some%2Fother-repository/releases?per_page=100')
        .reply(200, [
          { tag_name: `${prefix}1.0.0` },
          {
            tag_name: `${prefix}1.0.1`,
            description:
              'some body #123, [#124](https://gitlab.com/some/yet-other-repository/issues/124)',
          },
        ]);

      const res = await getReleaseNotes(
        {
          ...gitlabProject,
          repository: 'some/other-repository',
          packageName: 'other',
          apiBaseUrl: 'https://api.gitlab.com/',
        },
        partial<ChangeLogRelease>({
          version: '1.0.1',
          gitRef: '1.0.1',
        }),
        partial<BranchUpgradeConfig>(),
      );
      expect(res).toEqual({
        body: 'some body #123, [#124](https://gitlab.com/some/yet-other-repository/issues/124)',
        name: undefined,
        notesSourceUrl:
          'https://api.gitlab.com/projects/some%2Fother-repository/releases',
        tag: 'v1.0.1',
        url: 'https://gitlab.com/some/other-repository/tags/v1.0.1',
      });
    });

    it('gets release notes with body from gitlab repo "other-"', async () => {
      const prefix = 'other-';
      httpMock
        .scope('https://api.gitlab.com/')
        .get('/projects/some%2Fother-repository/releases?per_page=100')
        .reply(200, [
          { tag_name: `${prefix}1.0.0` },
          {
            tag_name: `${prefix}1.0.1`,
            description:
              'some body #123, [#124](https://gitlab.com/some/yet-other-repository/issues/124)',
          },
        ]);

      const res = await getReleaseNotes(
        {
          ...gitlabProject,
          repository: 'some/other-repository',
          packageName: 'other',
          apiBaseUrl: 'https://api.gitlab.com/',
        },
        partial<ChangeLogRelease>({
          version: '1.0.1',
          gitRef: '1.0.1',
        }),
        partial<BranchUpgradeConfig>(),
      );
      expect(res).toEqual({
        body: 'some body #123, [#124](https://gitlab.com/some/yet-other-repository/issues/124)',
        name: undefined,
        notesSourceUrl:
          'https://api.gitlab.com/projects/some%2Fother-repository/releases',
        tag: 'other-1.0.1',
        url: 'https://gitlab.com/some/other-repository/tags/other-1.0.1',
      });
    });

    it('gets null from repository without gitlab/github in domain', async () => {
      const res = await getReleaseNotes(
        partial<ChangeLogProject>({
          repository: 'some/repository',
          packageName: 'other',
          apiBaseUrl: 'https://api.lol.lol/',
          baseUrl: 'https://lol.lol/',
        }),
        partial<ChangeLogRelease>({
          version: '1.0.1',
          gitRef: '1.0.1',
        }),
        partial<BranchUpgradeConfig>(),
      );
      expect(res).toBeNull();
    });

    it('handles same version but different repo releases', async () => {
      const packageName = 'correctTagPrefix/exampleDep';
      githubReleasesMock.mockResolvedValueOnce([
        {
          id: 1,
          version: `${packageName}@1.0.0`,
          releaseTimestamp: '2020-01-01' as Timestamp,
          url: 'correct/url/tag.com',
          name: 'some/dep',
          description: 'some body',
        },
        {
          id: 2,
          version: `someOtherRelease1/exampleDep_1.0.0`,
          releaseTimestamp: '2020-01-01' as Timestamp,
          url: 'correct/url/tag.com',
          name: 'some/dep',
          description: 'some body',
        },
        {
          id: 3,
          version: `someOtherRelease2/exampleDep-1.0.0`,
          releaseTimestamp: '2020-01-01' as Timestamp,
          url: 'correct/url/tag.com',
          name: 'some/dep',
          description: 'some body',
        },
      ]);
      const res = await getReleaseNotes(
        {
          ...githubProject,
          repository: 'some/other-repository',
          packageName: 'exampleDep',
        },
        partial<ChangeLogRelease>({
          version: '1.0.0',
          gitRef: '1.0.0',
        }),
        partial<BranchUpgradeConfig>(),
      );
      expect(res).toEqual({
        url: 'correct/url/tag.com',
        notesSourceUrl:
          'https://api.github.com/repos/some/other-repository/releases',
        id: 1,
        tag: 'correctTagPrefix/exampleDep@1.0.0',
        name: 'some/dep',
        body: 'some body\n',
      });
    });

    it('fallback to extractVersion', async () => {
      githubReleasesMock.mockResolvedValueOnce([
        {
          id: 123,
          version: `app-1.0.0`,
          releaseTimestamp: '2020-01-01' as Timestamp,
          url: 'correct/url/tag.com',
          description: 'some body',
          name: 'some/dep',
        },
      ]);
      const res = await getReleaseNotes(
        {
          ...githubProject,
          repository: 'some/other-repository',
          packageName: 'exampleDep',
        },
        partial<ChangeLogRelease>({
          version: '1.0.0',
          gitRef: '1.0.0',
        }),
        partial<BranchUpgradeConfig>({
          extractVersion: 'app-(?<version>[0-9.]*)',
        }),
      );
      expect(res).toEqual({
        url: 'correct/url/tag.com',
        notesSourceUrl:
          'https://api.github.com/repos/some/other-repository/releases',
        id: 123,
        tag: 'app-1.0.0',
        name: 'some/dep',
        body: 'some body\n',
      });
    });
  });

  describe('getReleaseNotesMd()', () => {
    it('handles not found', async () => {
      httpMock.scope('https://api.github.com').get('/repos/chalk').reply(404);
      const res = await getReleaseNotesMd(
        {
          ...githubProject,
          repository: 'chalk',
        },
        partial<ChangeLogRelease>({
          version: '2.0.0',
          gitRef: '2.0.0',
        }),
      );
      expect(res).toBeNull();
    });

    it('handles files mismatch', async () => {
      httpMock
        .scope('https://api.github.com')
        .get('/repos/chalk')
        .reply(200)
        .get('/repos/chalk/git/trees/HEAD')
        .reply(200, {
          tree: [
            { name: 'lib', type: 'tree' },
            { name: 'README.md', type: 'blob' },
          ],
        });
      const res = await getReleaseNotesMd(
        {
          ...githubProject,
          repository: 'chalk',
        },
        partial<ChangeLogRelease>({
          version: '2.0.0',
          gitRef: '2.0.0',
        }),
      );
      expect(res).toBeNull();
    });

    it('handles wrong format', async () => {
      httpMock
        .scope('https://api.github.com')
        .get('/repos/some/repository1')
        .reply(200)
        .get('/repos/some/repository1/git/trees/HEAD')
        .reply(200, githubTreeResponse)
        .get('/repos/some/repository1/git/blobs/abcd')
        .reply(200, {
          content: toBase64('not really markdown'),
        });
      const res = await getReleaseNotesMd(
        {
          ...githubProject,
          repository: 'some/repository1',
        },
        partial<ChangeLogRelease>({
          version: '1.0.0',
          gitRef: '1.0.0',
        }),
      );
      expect(res).toBeNull();
    });

    it('handles bad markdown', async () => {
      httpMock
        .scope('https://api.github.com')
        .get('/repos/some/repository2')
        .reply(200)
        .get('/repos/some/repository2/git/trees/HEAD')
        .reply(200, githubTreeResponse)
        .get('/repos/some/repository2/git/blobs/abcd')
        .reply(200, {
          content: toBase64(`#\nha\nha\n#\nha\nha`),
        });
      const res = await getReleaseNotesMd(
        {
          ...githubProject,
          repository: 'some/repository2',
        },
        partial<ChangeLogRelease>({
          version: '1.0.0',
          gitRef: '1.0.0',
        }),
      );
      expect(res).toBeNull();
    });

    it('handles bitbucket release notes link', async () => {
      httpMock
        .scope('https://api.bitbucket.org')
        .get('/2.0/repositories/some-org/some-repo/src/HEAD?pagelen=100')
        .reply(200, bitbucketTreeResponse)
        .get('/2.0/repositories/some-org/some-repo/src/abcd/CHANGELOG.md')
        .reply(200, angularJsChangelogMd);

      const res = await getReleaseNotesMd(
        {
          ...bitbucketProject,
          repository: 'some-org/some-repo',
        },
        partial<ChangeLogRelease>({
          version: '1.6.9',
          gitRef: '1.6.9',
        }),
      );
      expect(res).toMatchObject({
        notesSourceUrl:
          'https://bitbucket.org/some-org/some-repo/src/HEAD/CHANGELOG.md',
        url: 'https://bitbucket.org/some-org/some-repo/src/HEAD/CHANGELOG.md#169-fiery-basilisk-2018-02-02',
      });
    });

    it('handles bitbucket-server release notes link', async () => {
      httpMock
        .scope(bitbucketServerProject.apiBaseUrl)
        .get('/projects/some-org/repos/some-repo/files?limit=100')
        .reply(200, {
          isLastPage: true,
          values: ['CHANGELOG.md'],
        })
        .get('/projects/some-org/repos/some-repo/raw/CHANGELOG.md')
        .reply(200, angularJsChangelogMd);

      const res = await getReleaseNotesMd(
        {
          ...bitbucketServerProject,
          repository: 'some-org/some-repo',
        },
        partial<ChangeLogRelease>({
          version: '1.6.9',
          gitRef: '1.6.9',
        }),
      );

      const notesSourceUrl = `${bitbucketServerProject.baseUrl}projects/some-org/repos/some-repo/browse/CHANGELOG.md?at=HEAD`;
      expect(res).toMatchObject({
        notesSourceUrl,
        url: `${notesSourceUrl}#169-fiery-basilisk-2018-02-02`,
      });
    });

    it('parses angular.js', async () => {
      httpMock
        .scope('https://api.github.com')
        .get('/repos/angular/angular.js')
        .reply(200)
        .get('/repos/angular/angular.js/git/trees/HEAD')
        .reply(200, githubTreeResponse)
        .get('/repos/angular/angular.js/git/blobs/abcd')
        .reply(200, {
          content: toBase64(angularJsChangelogMd),
        });
      const res = await getReleaseNotesMd(
        {
          ...githubProject,
          repository: 'angular/angular.js',
        },
        partial<ChangeLogRelease>({
          version: '1.6.9',
          gitRef: '1.6.9',
        }),
      );
      expect(res).toMatchInlineSnapshot(`
        {
          "body": "#### Bug Fixes

        - **input:** add \`drop\` event support for IE
          ([5dc076](https://github.com/angular/angular.js/commit/5dc07667de00c5e85fd69c5b7b7fe4fb5fd65a77))
        - **ngMessages:** prevent memory leak from messages that are never attached
          ([9d058d](https://github.com/angular/angular.js/commit/9d058de04bb78694b83179e9b97bc40214eca01a),
          [#16389](https://github.com/angular/angular.js/issues/16389),
          [#16404](https://github.com/angular/angular.js/issues/16404),
          [#16406](https://github.com/angular/angular.js/issues/16406))
        - **ngTransclude:** remove terminal: true
          ([1d826e](https://github.com/angular/angular.js/commit/1d826e2f1e941d14c3c56d7a0249f5796ba11f85),
          [#16411](https://github.com/angular/angular.js/issues/16411),
          [#16412](https://github.com/angular/angular.js/issues/16412))
        - **$sanitize:** sanitize \`xml:base\` attributes
          ([b9ef65](https://github.com/angular/angular.js/commit/b9ef6585e10477fbbf912a971fe0b390bca692a6))

        #### New Features

        - **currencyFilter:** trim whitespace around an empty currency symbol
          ([367390](https://github.com/angular/angular.js/commit/3673909896efb6ff47546caf7fc61549f193e043),
          [#15018](https://github.com/angular/angular.js/issues/15018),
          [#15085](https://github.com/angular/angular.js/issues/15085),
          [#15105](https://github.com/angular/angular.js/issues/15105))
        ",
          "notesSourceUrl": "https://github.com/angular/angular.js/blob/HEAD/CHANGELOG.md",
          "url": "https://github.com/angular/angular.js/blob/HEAD/CHANGELOG.md#169-fiery-basilisk-2018-02-02",
        }
      `);
    });

    it('parses gitlab.com/gitlab-org/gitter/webapp', async () => {
      httpMock
        .scope('https://api.gitlab.com/')
        .get(
          '/projects/gitlab-org%2Fgitter%2Fwebapp/repository/tree?per_page=100',
        )
        .reply(200, gitlabTreeResponse)
        .get('/projects/gitlab-org%2Fgitter%2Fwebapp/repository/blobs/abcd/raw')
        .reply(200, gitterWebappChangelogMd);
      const res = await getReleaseNotesMd(
        {
          ...gitlabProject,
          repository: 'gitlab-org/gitter/webapp',
          apiBaseUrl: 'https://api.gitlab.com/',
        },
        partial<ChangeLogRelease>({
          version: '20.26.0',
          gitRef: '20.26.0',
        }),
      );

      expect(res).toMatchInlineSnapshot(`
        {
          "body": "- Removing markup from a part of the French translation, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1878>
        - Fix typo documentation -> documentation, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1880>
          - Thanks to [@auua](https://gitlab.com/auua) for the contribution
        - Fix \`/channel\` slash command name regex to accept hyphenated names, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1881>
          - Thanks to [@auua](https://gitlab.com/auua) for the contribution
        - Add GitLab branding to the left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1865>
        - Fix left-menu search state showing all rooms, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1883>
        - Update Polish translation, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1882>
          - Thanks to [@biesiad](https://gitlab.com/biesiad) for the contribution
        ",
          "notesSourceUrl": "https://gitlab.com/gitlab-org/gitter/webapp/blob/HEAD/CHANGELOG.md",
          "url": "https://gitlab.com/gitlab-org/gitter/webapp/blob/HEAD/CHANGELOG.md#20260---2020-05-18",
        }
      `);
    });

    it('parses self hosted gitlab', async () => {
      hostRules.add({ token: 'some-token' });
      httpMock
        .scope('https://my.custom.domain/')
        .get(
          '/projects/gitlab-org%2Fgitter%2Fwebapp/repository/tree?per_page=100',
        )
        .reply(200, gitlabTreeResponse)
        .get('/projects/gitlab-org%2Fgitter%2Fwebapp/repository/blobs/abcd/raw')
        .reply(200, gitterWebappChangelogMd);
      const res = await getReleaseNotesMd(
        {
          ...gitlabProject,
          repository: 'gitlab-org/gitter/webapp',
          apiBaseUrl: 'https://my.custom.domain/',
          baseUrl: 'https://my.custom.domain/',
        },
        partial<ChangeLogRelease>({
          version: '20.26.0',
          gitRef: '20.26.0',
        }),
      );

      expect(res).toMatchInlineSnapshot(`
        {
          "body": "- Removing markup from a part of the French translation, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1878>
        - Fix typo documentation -> documentation, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1880>
          - Thanks to [@auua](https://gitlab.com/auua) for the contribution
        - Fix \`/channel\` slash command name regex to accept hyphenated names, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1881>
          - Thanks to [@auua](https://gitlab.com/auua) for the contribution
        - Add GitLab branding to the left-menu, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1865>
        - Fix left-menu search state showing all rooms, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1883>
        - Update Polish translation, <https://gitlab.com/gitlab-org/gitter/webapp/-/merge_requests/1882>
          - Thanks to [@biesiad](https://gitlab.com/biesiad) for the contribution
        ",
          "notesSourceUrl": "https://my.custom.domain/gitlab-org/gitter/webapp/blob/HEAD/CHANGELOG.md",
          "url": "https://my.custom.domain/gitlab-org/gitter/webapp/blob/HEAD/CHANGELOG.md#20260---2020-05-18",
        }
      `);
    });

    it('parses jest', async () => {
      httpMock
        .scope('https://api.github.com')
        .get('/repos/facebook/jest')
        .reply(200)
        .get('/repos/facebook/jest/git/trees/HEAD')
        .reply(200, githubTreeResponse)
        .get('/repos/facebook/jest/git/blobs/abcd')
        .reply(200, {
          content: toBase64(jestChangelogMd),
        });
      const res = await getReleaseNotesMd(
        {
          ...githubProject,
          repository: 'facebook/jest',
        },
        partial<ChangeLogRelease>({
          version: '22.0.0',
          gitRef: '22.0.0',
        }),
      );

      expect(res).toMatchInlineSnapshot(`
        {
          "body": "##### Fixes

        - \`[jest-resolve]\` Use \`module.builtinModules\` as \`BUILTIN_MODULES\` when it
          exists
        - \`[jest-worker]\` Remove \`debug\` and \`inspect\` flags from the arguments sent to
          the child ([#5068](https://github.com/facebook/jest/pull/5068))
        - \`[jest-config]\` Use all \`--testPathPattern\` and \`<regexForTestFiles>\` args in
          \`testPathPattern\` ([#5066](https://github.com/facebook/jest/pull/5066))
        - \`[jest-cli]\` Do not support \`--watch\` inside non-version-controlled
          environments ([#5060](https://github.com/facebook/jest/pull/5060))
        - \`[jest-config]\` Escape Windows path separator in testPathPattern CLI arguments
          ([#5054](https://github.com/facebook/jest/pull/5054)
        - \`[jest-jasmine]\` Register sourcemaps as node environment to improve
          performance with jsdom ([#5045](https://github.com/facebook/jest/pull/5045))
        - \`[pretty-format]\` Do not call toJSON recursively
          ([#5044](https://github.com/facebook/jest/pull/5044))
        - \`[pretty-format]\` Fix errors when identity-obj-proxy mocks CSS Modules
          ([#4935](https://github.com/facebook/jest/pull/4935))
        - \`[babel-jest]\` Fix support for namespaced babel version 7
          ([#4918](https://github.com/facebook/jest/pull/4918))
        - \`[expect]\` fix .toThrow for promises
          ([#4884](https://github.com/facebook/jest/pull/4884))
        - \`[jest-docblock]\` pragmas should preserve urls
          ([#4837](https://github.com/facebook/jest/pull/4629))
        - \`[jest-cli]\` Check if \`npm_lifecycle_script\` calls Jest directly
          ([#4629](https://github.com/facebook/jest/pull/4629))
        - \`[jest-cli]\` Fix --showConfig to show all configs
          ([#4494](https://github.com/facebook/jest/pull/4494))
        - \`[jest-cli]\` Throw if \`maxWorkers\` doesn't have a value
          ([#4591](https://github.com/facebook/jest/pull/4591))
        - \`[jest-cli]\` Use \`fs.realpathSync.native\` if available
          ([#5031](https://github.com/facebook/jest/pull/5031))
        - \`[jest-config]\` Fix \`--passWithNoTests\`
          ([#4639](https://github.com/facebook/jest/pull/4639))
        - \`[jest-config]\` Support \`rootDir\` tag in testEnvironment
          ([#4579](https://github.com/facebook/jest/pull/4579))
        - \`[jest-editor-support]\` Fix \`--showConfig\` to support jest 20 and jest 21
          ([#4575](https://github.com/facebook/jest/pull/4575))
        - \`[jest-editor-support]\` Fix editor support test for node 4
          ([#4640](https://github.com/facebook/jest/pull/4640))
        - \`[jest-mock]\` Support mocking constructor in \`mockImplementationOnce\`
          ([#4599](https://github.com/facebook/jest/pull/4599))
        - \`[jest-runtime]\` Fix manual user mocks not working with custom resolver
          ([#4489](https://github.com/facebook/jest/pull/4489))
        - \`[jest-util]\` Fix \`runOnlyPendingTimers\` for \`setTimeout\` inside
          \`setImmediate\` ([#4608](https://github.com/facebook/jest/pull/4608))
        - \`[jest-message-util]\` Always remove node internals from stacktraces
          ([#4695](https://github.com/facebook/jest/pull/4695))
        - \`[jest-resolve]\` changes method of determining builtin modules to include
          missing builtins ([#4740](https://github.com/facebook/jest/pull/4740))
        - \`[pretty-format]\` Prevent error in pretty-format for window in jsdom test env
          ([#4750](https://github.com/facebook/jest/pull/4750))
        - \`[jest-resolve]\` Preserve module identity for symlinks
          ([#4761](https://github.com/facebook/jest/pull/4761))
        - \`[jest-config]\` Include error message for \`preset\` json
          ([#4766](https://github.com/facebook/jest/pull/4766))
        - \`[pretty-format]\` Throw \`PrettyFormatPluginError\` if a plugin halts with an
          exception ([#4787](https://github.com/facebook/jest/pull/4787))
        - \`[expect]\` Keep the stack trace unchanged when \`PrettyFormatPluginError\` is
          thrown by pretty-format ([#4787](https://github.com/facebook/jest/pull/4787))
        - \`[jest-environment-jsdom]\` Fix asynchronous test will fail due to timeout
          issue. ([#4669](https://github.com/facebook/jest/pull/4669))
        - \`[jest-cli]\` Fix \`--onlyChanged\` path case sensitivity on Windows platform
          ([#4730](https://github.com/facebook/jest/pull/4730))
        - \`[jest-runtime]\` Use realpath to match transformers
          ([#5000](https://github.com/facebook/jest/pull/5000))
        - \`[expect]\` \\[**BREAKING**] Replace identity equality with Object.is in toBe
          matcher ([#4917](https://github.com/facebook/jest/pull/4917))

        ##### Features

        - \`[jest-message-util]\` Add codeframe to test assertion failures
          ([#5087](https://github.com/facebook/jest/pull/5087))
        - \`[jest-config]\` Add Global Setup/Teardown options
          ([#4716](https://github.com/facebook/jest/pull/4716))
        - \`[jest-config]\` Add \`testEnvironmentOptions\` to apply to jsdom options or node
          context. ([#5003](https://github.com/facebook/jest/pull/5003))
        - \`[jest-jasmine2]\` Update Timeout error message to \`jest.timeout\` and display
          current timeout value ([#4990](https://github.com/facebook/jest/pull/4990))
        - \`[jest-runner]\` Enable experimental detection of leaked contexts
          ([#4895](https://github.com/facebook/jest/pull/4895))
        - \`[jest-cli]\` Add combined coverage threshold for directories.
          ([#4885](https://github.com/facebook/jest/pull/4885))
        - \`[jest-mock]\` Add \`timestamps\` to mock state.
          ([#4866](https://github.com/facebook/jest/pull/4866))
        - \`[eslint-plugin-jest]\` Add \`prefer-to-have-length\` lint rule.
          ([#4771](https://github.com/facebook/jest/pull/4771))
        - \`[jest-environment-jsdom]\` \\[**BREAKING**] Upgrade to JSDOM\\@11
          ([#4770](https://github.com/facebook/jest/pull/4770))
        - \`[jest-environment-*]\` \\[**BREAKING**] Add Async Test Environment APIs, dispose
          is now teardown ([#4506](https://github.com/facebook/jest/pull/4506))
        - \`[jest-cli]\` Add an option to clear the cache
          ([#4430](https://github.com/facebook/jest/pull/4430))
        - \`[babel-plugin-jest-hoist]\` Improve error message, that the second argument of
          \`jest.mock\` must be an inline function
          ([#4593](https://github.com/facebook/jest/pull/4593))
        - \`[jest-snapshot]\` \\[**BREAKING**] Concatenate name of test and snapshot
          ([#4460](https://github.com/facebook/jest/pull/4460))
        - \`[jest-cli]\` \\[**BREAKING**] Fail if no tests are found
          ([#3672](https://github.com/facebook/jest/pull/3672))
        - \`[jest-diff]\` Highlight only last of odd length leading spaces
          ([#4558](https://github.com/facebook/jest/pull/4558))
        - \`[jest-docblock]\` Add \`docblock.print()\`
          ([#4517](https://github.com/facebook/jest/pull/4517))
        - \`[jest-docblock]\` Add \`strip\`
          ([#4571](https://github.com/facebook/jest/pull/4571))
        - \`[jest-docblock]\` Preserve leading whitespace in docblock comments
          ([#4576](https://github.com/facebook/jest/pull/4576))
        - \`[jest-docblock]\` remove leading newlines from \`parswWithComments().comments\`
          ([#4610](https://github.com/facebook/jest/pull/4610))
        - \`[jest-editor-support]\` Add Snapshots metadata
          ([#4570](https://github.com/facebook/jest/pull/4570))
        - \`[jest-editor-support]\` Adds an 'any' to the typedef for
          \`updateFileWithJestStatus\`
          ([#4636](https://github.com/facebook/jest/pull/4636))
        - \`[jest-editor-support]\` Better monorepo support
          ([#4572](https://github.com/facebook/jest/pull/4572))
        - \`[jest-environment-jsdom]\` Add simple rAF polyfill in jsdom environment to
          work with React 16 ([#4568](https://github.com/facebook/jest/pull/4568))
        - \`[jest-environment-node]\` Implement node Timer api
          ([#4622](https://github.com/facebook/jest/pull/4622))
        - \`[jest-jasmine2]\` Add testPath to reporter callbacks
          ([#4594](https://github.com/facebook/jest/pull/4594))
        - \`[jest-mock]\` Added support for naming mocked functions with
          \`.mockName(value)\` and \`.mockGetName()\`
          ([#4586](https://github.com/facebook/jest/pull/4586))
        - \`[jest-runtime]\` Add \`module.loaded\`, and make \`module.require\` not enumerable
          ([#4623](https://github.com/facebook/jest/pull/4623))
        - \`[jest-runtime]\` Add \`module.parent\`
          ([#4614](https://github.com/facebook/jest/pull/4614))
        - \`[jest-runtime]\` Support sourcemaps in transformers
          ([#3458](https://github.com/facebook/jest/pull/3458))
        - \`[jest-snapshot]\` \\[**BREAKING**] Add a serializer for \`jest.fn\` to allow a
          snapshot of a jest mock ([#4668](https://github.com/facebook/jest/pull/4668))
        - \`[jest-worker]\` Initial version of parallel worker abstraction, say hello!
          ([#4497](https://github.com/facebook/jest/pull/4497))
        - \`[jest-jasmine2]\` Add \`testLocationInResults\` flag to add location information
          per spec to test results ([#4782](https://github.com/facebook/jest/pull/4782))
        - \`[jest-environment-jsdom]\` Update JSOM to 11.4, which includes built-in
          support for \`requestAnimationFrame\`
          ([#4919](https://github.com/facebook/jest/pull/4919))
        - \`[jest-cli]\` Hide watch usage output when running on non-interactive
          environments ([#4958](https://github.com/facebook/jest/pull/4958))
        - \`[jest-snapshot]\` Promises support for \`toThrowErrorMatchingSnapshot\`
          ([#4946](https://github.com/facebook/jest/pull/4946))
        - \`[jest-cli]\` Explain which snapshots are obsolete
          ([#5005](https://github.com/facebook/jest/pull/5005))

        ##### Chore & Maintenance

        - \`[docs]\` Add guide of using with puppeteer
          ([#5093](https://github.com/facebook/jest/pull/5093))
        - \`[jest-util]\` \`jest-util\` should not depend on \`jest-mock\`
          ([#4992](https://github.com/facebook/jest/pull/4992))
        - \`[*]\` \\[**BREAKING**] Drop support for Node.js version 4
          ([#4769](https://github.com/facebook/jest/pull/4769))
        - \`[docs]\` Wrap code comments at 80 characters
          ([#4781](https://github.com/facebook/jest/pull/4781))
        - \`[eslint-plugin-jest]\` Removed from the Jest core repo, and moved to
          <https://github.com/jest-community/eslint-plugin-jest>
          ([#4867](https://github.com/facebook/jest/pull/4867))
        - \`[babel-jest]\` Explicitly bump istanbul to newer versions
          ([#4616](https://github.com/facebook/jest/pull/4616))
        - \`[expect]\` Upgrade mocha and rollup for browser testing
          ([#4642](https://github.com/facebook/jest/pull/4642))
        - \`[docs]\` Add info about \`coveragePathIgnorePatterns\`
          ([#4602](https://github.com/facebook/jest/pull/4602))
        - \`[docs]\` Add Vuejs series of testing with Jest
          ([#4648](https://github.com/facebook/jest/pull/4648))
        - \`[docs]\` Mention about optional \`done\` argument in test function
          ([#4556](https://github.com/facebook/jest/pull/4556))
        - \`[jest-cli]\` Bump node-notifier version
          ([#4609](https://github.com/facebook/jest/pull/4609))
        - \`[jest-diff]\` Simplify highlight for leading and trailing spaces
          ([#4553](https://github.com/facebook/jest/pull/4553))
        - \`[jest-get-type]\` Add support for date
          ([#4621](https://github.com/facebook/jest/pull/4621))
        - \`[jest-matcher-utils]\` Call \`chalk.inverse\` for trailing spaces
          ([#4578](https://github.com/facebook/jest/pull/4578))
        - \`[jest-runtime]\` Add \`.advanceTimersByTime\`; keep \`.runTimersToTime()\` as an
          alias.
        - \`[docs]\` Include missing dependency in TestEnvironment sample code
        - \`[docs]\` Add clarification for hook execution order
        - \`[docs]\` Update \`expect.anything()\` sample code
          ([#5007](https://github.com/facebook/jest/pull/5007))
        ",
          "notesSourceUrl": "https://github.com/facebook/jest/blob/HEAD/CHANGELOG.md",
          "url": "https://github.com/facebook/jest/blob/HEAD/CHANGELOG.md#jest-2200",
        }
      `);
    });

    it('handles github sourceDirectory', async () => {
      const sourceDirectory = 'packages/foo';
      const subdirTree = clone(githubTreeResponse);
      for (const file of subdirTree.tree) {
        file.path = `${sourceDirectory}/${file.path}`;
      }
      httpMock
        .scope('https://api.github.com')
        .get('/repos/nodeca/js-yaml')
        .reply(200)
        .get('/repos/nodeca/js-yaml/git/trees/HEAD?recursive=1')
        .reply(200, subdirTree)
        .get('/repos/nodeca/js-yaml/git/blobs/abcd')
        .reply(200, {
          content: toBase64(jsYamlChangelogMd),
        });
      const res = await getReleaseNotesMd(
        {
          ...githubProject,
          repository: 'nodeca/js-yaml',
          sourceDirectory,
        },
        partial<ChangeLogRelease>({
          version: '3.10.0',
          gitRef: '3.10.0',
        }),
      );

      expect(res).toMatchInlineSnapshot(`
        {
          "body": "- Fix \`condenseFlow\` output (quote keys for sure, instead of spaces), [#371](https://github.com/nodeca/js-yaml/issues/371), [#370](https://github.com/nodeca/js-yaml/issues/370).
        - Dump astrals as codepoints instead of surrogate pair, [#368](https://github.com/nodeca/js-yaml/issues/368).
        ",
          "notesSourceUrl": "https://github.com/nodeca/js-yaml/blob/HEAD/packages/foo/CHANGELOG.md",
          "url": "https://github.com/nodeca/js-yaml/blob/HEAD/packages/foo/CHANGELOG.md#3100--2017-09-10",
        }
      `);
    });

    it('parses js-yaml', async () => {
      httpMock
        .scope('https://api.github.com')
        .get('/repos/nodeca/js-yaml')
        .reply(200)
        .get('/repos/nodeca/js-yaml/git/trees/HEAD')
        .reply(200, githubTreeResponse)
        .get('/repos/nodeca/js-yaml/git/blobs/abcd')
        .reply(200, {
          content: toBase64(jsYamlChangelogMd),
        });
      const res = await getReleaseNotesMd(
        {
          ...githubProject,
          repository: 'nodeca/js-yaml',
        },
        partial<ChangeLogRelease>({
          version: '3.10.0',
          gitRef: '3.10.0',
        }),
      );

      expect(res).toMatchInlineSnapshot(`
        {
          "body": "- Fix \`condenseFlow\` output (quote keys for sure, instead of spaces), [#371](https://github.com/nodeca/js-yaml/issues/371), [#370](https://github.com/nodeca/js-yaml/issues/370).
        - Dump astrals as codepoints instead of surrogate pair, [#368](https://github.com/nodeca/js-yaml/issues/368).
        ",
          "notesSourceUrl": "https://github.com/nodeca/js-yaml/blob/HEAD/CHANGELOG.md",
          "url": "https://github.com/nodeca/js-yaml/blob/HEAD/CHANGELOG.md#3100--2017-09-10",
        }
      `);
    });

    it('ignores invalid', async () => {
      const res = await getReleaseNotesMd(
        partial<ChangeLogProject>({
          repository: 'nodeca/js-yaml',
        }),
        partial<ChangeLogRelease>({
          version: '3.10.0',
          gitRef: '3.10.0',
        }),
      );
      expect(res).toBeNull();
    });

    describe('ReleaseNotes Correctness', () => {
      let versionOneNotes: ChangeLogNotes;
      let versionTwoNotes: ChangeLogNotes;

      it('parses yargs 15.3.0', async () => {
        httpMock
          .scope('https://api.github.com')
          .get('/repos/yargs/yargs')
          .reply(200, { default_branch: 'main' })
          .get('/repos/yargs/yargs/git/trees/main')
          .reply(200, githubTreeResponse)
          .get('/repos/yargs/yargs/git/blobs/abcd')
          .reply(200, {
            content: toBase64(yargsChangelogMd),
          });
        const res = await getReleaseNotesMd(
          {
            ...githubProject,
            repository: 'yargs/yargs',
          },
          partial<ChangeLogRelease>({
            version: '15.3.0',
            gitRef: '15.3.0',
          }),
        );
        versionOneNotes = res!;

        expect(res).toMatchInlineSnapshot(`
          {
            "body": "##### Features

          - **yargs-parser:** introduce single-digit boolean aliases ([#1576](https://www.github.com/yargs/yargs/issues/1576)) ([3af7f04](https://www.github.com/yargs/yargs/commit/3af7f04cdbfcbd4b3f432aca5144d43f21958c39))
          - add usage for single-digit boolean aliases ([#1580](https://www.github.com/yargs/yargs/issues/1580)) ([6014e39](https://www.github.com/yargs/yargs/commit/6014e39bca3a1e8445aa0fb2a435f6181e344c45))

          ##### Bug Fixes

          - address ambiguity between nargs of 1 and requiresArg ([#1572](https://www.github.com/yargs/yargs/issues/1572)) ([a5edc32](https://www.github.com/yargs/yargs/commit/a5edc328ecb3f90d1ba09cfe70a0040f68adf50a))
          ",
            "notesSourceUrl": "https://github.com/yargs/yargs/blob/HEAD/CHANGELOG.md",
            "url": "https://github.com/yargs/yargs/blob/HEAD/CHANGELOG.md#1530-2020-03-08",
          }
        `);
      });

      it('parses yargs 15.2.0', async () => {
        httpMock
          .scope('https://api.github.com')
          .get('/repos/yargs/yargs')
          .reply(200, { default_branch: 'main' })
          .get('/repos/yargs/yargs/git/trees/main')
          .reply(200, githubTreeResponse)
          .get('/repos/yargs/yargs/git/blobs/abcd')
          .reply(200, {
            content: toBase64(yargsChangelogMd),
          });
        const res = await getReleaseNotesMd(
          {
            ...githubProject,
            repository: 'yargs/yargs',
          },
          partial<ChangeLogRelease>({
            version: '15.2.0',
            gitRef: '15.2.0',
          }),
        );
        versionTwoNotes = res!;

        expect(res).toMatchInlineSnapshot(`
          {
            "body": "##### ⚠ BREAKING CHANGES

          - **deps:** yargs-parser\\@17.0.0 no longer implicitly creates arrays out of boolean
            arguments when duplicates are provided

          ##### Features

          - **completion:** takes negated flags into account when boolean-negation is set ([#1509](https://www.github.com/yargs/yargs/issues/1509)) ([7293ad5](https://www.github.com/yargs/yargs/commit/7293ad50d20ea0fb7dd1ac9b925e90e1bd95dea8))
          - **deps:** pull in yargs-parser\\@17.0.0 ([#1553](https://www.github.com/yargs/yargs/issues/1553)) ([b9409da](https://www.github.com/yargs/yargs/commit/b9409da199ebca515a848489c206b807fab2e65d))
          - deprecateOption ([#1559](https://www.github.com/yargs/yargs/issues/1559)) ([8aae333](https://www.github.com/yargs/yargs/commit/8aae3332251d09fa136db17ef4a40d83fa052bc4))
          - display appropriate $0 for electron apps ([#1536](https://www.github.com/yargs/yargs/issues/1536)) ([d0e4379](https://www.github.com/yargs/yargs/commit/d0e437912917d6a66bb5128992fa2f566a5f830b))
          - introduces strictCommands() subset of strict mode ([#1540](https://www.github.com/yargs/yargs/issues/1540)) ([1d4cca3](https://www.github.com/yargs/yargs/commit/1d4cca395a98b395e6318f0505fc73bef8b01350))
          - **deps:** yargs-parser with 'greedy-array' configuration ([#1569](https://www.github.com/yargs/yargs/issues/1569)) ([a03a320](https://www.github.com/yargs/yargs/commit/a03a320dbf5c0ce33d829a857fc04a651c0bb53e))

          ##### Bug Fixes

          - help always displayed for the first command parsed having an async handler ([#1535](https://www.github.com/yargs/yargs/issues/1535)) ([d585b30](https://www.github.com/yargs/yargs/commit/d585b303a43746201b05c9c9fda94a444634df33))
          - **deps:** fix enumeration for normalized path arguments ([#1567](https://www.github.com/yargs/yargs/issues/1567)) ([0b5b1b0](https://www.github.com/yargs/yargs/commit/0b5b1b0e5f4f9baf393c48e9cc2bc85c1b67a47a))
          - **locales:** only translate default option group name ([acc16de](https://www.github.com/yargs/yargs/commit/acc16de6b846ea7332db753646a9cec76b589162))
          - **locales:** remove extra space in French for 'default' ([#1564](https://www.github.com/yargs/yargs/issues/1564)) ([ecfc2c4](https://www.github.com/yargs/yargs/commit/ecfc2c474575c6cdbc6d273c94c13181bd1dbaa6))
          - **translations:** add French translation for unknown command ([#1563](https://www.github.com/yargs/yargs/issues/1563)) ([18b0b75](https://www.github.com/yargs/yargs/commit/18b0b752424bf560271e670ff95a0f90c8386787))
          - **translations:** fix pluralization in error messages. ([#1557](https://www.github.com/yargs/yargs/issues/1557)) ([94fa38c](https://www.github.com/yargs/yargs/commit/94fa38cbab8d86943e87bf41d368ed56dffa6835))
          - **yargs:** correct support of bundled electron apps ([#1554](https://www.github.com/yargs/yargs/issues/1554)) ([a0b61ac](https://www.github.com/yargs/yargs/commit/a0b61ac21e2b554aa73dbf1a66d4a7af94047c2f))
          ",
            "notesSourceUrl": "https://github.com/yargs/yargs/blob/HEAD/CHANGELOG.md",
            "url": "https://github.com/yargs/yargs/blob/HEAD/CHANGELOG.md#1520-2020-03-01",
          }
        `);
      });

      it('parses adapter-utils 4.33.0', async () => {
        httpMock
          .scope('https://gitlab.com/')
          .get(
            '/api/v4/projects/itentialopensource%2Fadapter-utils/repository/tree?per_page=100',
          )
          .reply(200, gitlabTreeResponse)
          .get(
            '/api/v4/projects/itentialopensource%2Fadapter-utils/repository/blobs/abcd/raw',
          )
          .reply(200, adapterutilsChangelogMd);
        const res = await getReleaseNotesMd(
          {
            ...gitlabProject,
            repository: 'itentialopensource/adapter-utils',
          },
          partial<ChangeLogRelease>({
            version: '4.33.0',
            gitRef: '4.33.0',
          }),
        );
        versionTwoNotes = res!;

        expect(res).toMatchInlineSnapshot(`
          {
            "body": "- add new auth, fix accept header and base path in mock

          Closes ADAPT-207

          See merge request itentialopensource/adapter-utils!177

          ***
          ",
            "notesSourceUrl": "https://gitlab.com/itentialopensource/adapter-utils/blob/HEAD/CHANGELOG.md",
            "url": "https://gitlab.com/itentialopensource/adapter-utils/blob/HEAD/CHANGELOG.md#4330-05-15-2020",
          }
        `);
      });

      it('parses when version contained in the body 0.14.0', async () => {
        httpMock
          .scope('https://api.github.com')
          .get('/repos/embroider-build/release-plan')
          .reply(200, { default_branch: 'main' })
          .get('/repos/embroider-build/release-plan/git/trees/main')
          .reply(200, githubTreeResponse)
          .get('/repos/embroider-build/release-plan/git/blobs/abcd')
          .reply(200, {
            content: toBase64(releasePlanChangelogMd),
          });
        const res = await getReleaseNotesMd(
          {
            ...githubProject,
            repository: 'embroider-build/release-plan',
            packageName: 'release-plan',
          },
          partial<ChangeLogRelease>({
            version: '0.14.0',
            gitRef: '0.14.0',
          }),
        );
        versionTwoNotes = res!;

        expect(res?.notesSourceUrl).toStrictEqual(
          'https://github.com/embroider-build/release-plan/blob/HEAD/CHANGELOG.md',
        );
        expect(res?.url).toStrictEqual(
          'https://github.com/embroider-build/release-plan/blob/HEAD/CHANGELOG.md#Release-2025-03-03',
        );
      });

      it('ignores trailing link reference definitions when searching body', async () => {
        httpMock
          .scope('https://api.github.com')
          .get('/repos/taiki-e/upload-rust-binary-action')
          .reply(200, { default_branch: 'main' })
          .get('/repos/taiki-e/upload-rust-binary-action/git/trees/main')
          .reply(200, githubTreeResponse)
          .get('/repos/taiki-e/upload-rust-binary-action/git/blobs/abcd')
          .reply(200, {
            content: toBase64(keepAChangelogMd),
          });
        const res = await getReleaseNotesMd(
          {
            ...githubProject,
            repository: 'taiki-e/upload-rust-binary-action',
            packageName: 'taiki-e/upload-rust-binary-action',
          },
          partial<ChangeLogRelease>({
            version: '1.30.2',
            gitRef: '1.30.2',
          }),
        );

        expect(res).toBeNull();
      });

      it('handles gitlab sourceDirectory', async () => {
        const sourceDirectory = 'packages/foo';
        const response = clone(gitlabTreeResponse).map((file) => ({
          ...file,
          path: `${sourceDirectory}/${file.path}`,
        }));
        httpMock
          .scope('https://gitlab.com/')
          .get(
            `/api/v4/projects/itentialopensource%2Fadapter-utils/repository/tree?per_page=100&path=${sourceDirectory}`,
          )
          .reply(200, response)
          .get(
            '/api/v4/projects/itentialopensource%2Fadapter-utils/repository/blobs/abcd/raw',
          )
          .reply(200, adapterutilsChangelogMd);
        const res = await getReleaseNotesMd(
          {
            ...gitlabProject,
            repository: 'itentialopensource/adapter-utils',
            sourceDirectory,
          },
          partial<ChangeLogRelease>({
            version: '4.33.0',
            gitRef: '4.33.0',
          }),
        );
        versionTwoNotes = res!;

        expect(res).toMatchInlineSnapshot(`
          {
            "body": "- add new auth, fix accept header and base path in mock

          Closes ADAPT-207

          See merge request itentialopensource/adapter-utils!177

          ***
          ",
            "notesSourceUrl": "https://gitlab.com/itentialopensource/adapter-utils/blob/HEAD/packages/foo/CHANGELOG.md",
            "url": "https://gitlab.com/itentialopensource/adapter-utils/blob/HEAD/packages/foo/CHANGELOG.md#4330-05-15-2020",
          }
        `);
      });

      it('handles skipped packages', async () => {
        const res = await getReleaseNotesMd(
          {
            ...githubProject,
            repository: 'facebook/react-native',
          },
          partial<ChangeLogRelease>({
            version: '0.72.3',
            gitRef: '0.72.3',
          }),
        );
        expect(res).toBeNull();
      });

      it('isUrl', () => {
        expect(versionOneNotes).not.toMatchObject(versionTwoNotes);
      });

      it('15.3.0 is not equal to 15.2.0', () => {
        expect(versionOneNotes).not.toMatchObject(versionTwoNotes);
      });
    });

    it('returns empty body when changelog section has no content', async () => {
      httpMock
        .scope('https://api.github.com')
        .get('/repos/some/repository1')
        .reply(200)
        .get('/repos/some/repository1/git/trees/HEAD')
        .reply(200, githubTreeResponse)
        .get('/repos/some/repository1/git/blobs/abcd')
        .reply(200, {
          content: toBase64('## 1.0.0\n\n## 0.9.0\nSome old content\n'),
        });
      const res = await getReleaseNotesMd(
        {
          ...githubProject,
          repository: 'some/repository1',
        },
        partial<ChangeLogRelease>({
          version: '1.0.0',
          gitRef: '1.0.0',
        }),
      );
      expect(res).toMatchObject({ body: '' });
    });

    describe('shouldSkipChangelogMd', () => {
      it('should skip for flagged repository', () => {
        expect(shouldSkipChangelogMd('facebook/react-native')).toBeTrue();
      });

      it('should continue for other repository', () => {
        expect(shouldSkipChangelogMd('some/repo')).toBeFalse();
      });
    });
  });

  describe('massageBody()', () => {
    it('does not modify # inside codeblocks', () => {
      const str =
        '  # Version 3.2.0' +
        '\n' +
        '* [Chore]: always publish build scans on CI. Optionally publish them locally.' +
        '\n' +
        '\n' +
        'To publish build scans, add the following, as indicated:' +
        '```' +
        '\n' +
        '# ~/.gradle/gradle.properties' +
        '\n' +
        'dependency.analysis.scans.publish=true' +
        '```';
      expect(massageBody(str, 'https://github.com/foo/bar/')).toBe(
        str.replace('  # Version 3.2.0', '### Version 3.2.0'),
      );
    });
  });
});
