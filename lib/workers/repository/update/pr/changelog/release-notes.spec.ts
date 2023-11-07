import { mockDeep } from 'jest-mock-extended';
import { DateTime } from 'luxon';
import { Fixtures } from '../../../../../../test/fixtures';
import * as httpMock from '../../../../../../test/http-mock';
import { mocked, partial } from '../../../../../../test/util';
import { clone } from '../../../../../util/clone';
import * as githubGraphql from '../../../../../util/github/graphql';
import type { GithubReleaseItem } from '../../../../../util/github/graphql/types';
import * as _hostRules from '../../../../../util/host-rules';
import { toBase64 } from '../../../../../util/string';
import type { BranchUpgradeConfig } from '../../../../types';
import {
  addReleaseNotes,
  getReleaseList,
  getReleaseNotes,
  getReleaseNotesMd,
  releaseNotesCacheMinutes,
  shouldSkipChangelogMd,
} from './release-notes';
import type {
  ChangeLogNotes,
  ChangeLogProject,
  ChangeLogRelease,
  ChangeLogResult,
} from './types';

jest.mock('../../../../../util/host-rules', () => mockDeep());

const hostRules = mocked(_hostRules);

const angularJsChangelogMd = Fixtures.get('angular-js.md', '..');
const jestChangelogMd = Fixtures.get('jest.md', '..');
const jsYamlChangelogMd = Fixtures.get('js-yaml.md', '..');
const yargsChangelogMd = Fixtures.get('yargs.md', '..');
const adapterutilsChangelogMd = Fixtures.get('adapter-utils.md', '..');
const gitterWebappChangelogMd = Fixtures.get('gitter-webapp.md', '..');

const githubTreeResponse = {
  tree: [
    { path: 'lib', type: 'tree' },
    { path: 'CHANGELOG.md', type: 'blob', sha: 'abcd' },
    { path: 'README.md', type: 'blob' },
  ],
};

const gitlabTreeResponse = [
  { path: 'lib', name: 'lib', type: 'tree' },
  { path: 'CHANGELOG.md', name: 'CHANGELOG.md', type: 'blob', id: 'abcd' },
  { path: 'README.md', name: 'README.md', type: 'blob' },
];

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
  const githubReleasesMock = jest.spyOn(githubGraphql, 'queryReleases');

  beforeEach(() => {
    hostRules.find.mockReturnValue({});
    hostRules.hosts.mockReturnValue([]);
  });

  describe('releaseNotesCacheMinutes', () => {
    const now = DateTime.local();

    it.each([
      [now, 55],
      [now.minus({ weeks: 2 }), 1435],
      [now.minus({ years: 1 }), 14495],
    ])('works with string date (%s, %i)', (date, minutes) => {
      expect(releaseNotesCacheMinutes(date.toISO()!)).toEqual(minutes);
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
          releaseTimestamp: '2020-01-01',
          id: 1,
          url: 'https://example.com',
          name: 'some/dep',
          description: 'some body',
        },
        {
          version: `v1.0.1`,
          releaseTimestamp: '2020-01-01',
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
      hostRules.find.mockReturnValue({ token: 'some-token' });
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
  });

  describe('getReleaseNotes()', () => {
    it('should return null for release notes without body and name', async () => {
      githubReleasesMock.mockResolvedValueOnce([
        {
          version: '1.0.0',
          releaseTimestamp: '2020-01-01',
          id: 1,
          url: 'https://github.com/some/other-repository/releases/1.0.0',
          name: '',
          description: '',
        },
        {
          version: '1.0.1',
          releaseTimestamp: '2020-01-01',
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
          releaseTimestamp: '2020-01-01',
          id: 1,
          url: 'https://github.com/some/other-repository/releases/1.0.0',
          name: 'some/dep',
          description: 'some body',
        },
        {
          version: '1.0.1',
          releaseTimestamp: '2020-01-01',
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
          releaseTimestamp: '2020-01-01',
          id: 1,
          url: 'https://github.com/some/other-repository/releases/1.0.0',
          name: 'some/dep',
          description: '',
        },
        {
          version: '1.0.1',
          releaseTimestamp: '2020-01-01',
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
          releaseTimestamp: '2020-01-01',
          id: 1,
          url: 'https://github.com/some/other-repository/releases/1.0.0',
          name: 'Release v1.0.0',
          description: 'some body',
        },
        {
          version: '1.0.1',
          releaseTimestamp: '2020-01-01',
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
          releaseTimestamp: '2020-01-01',
          id: 1,
          url: 'https://github.com/some/other-repository/releases/1.0.1',
          name: 'some/dep',
          description: 'some body',
        },
        {
          version: '1.0.1',
          releaseTimestamp: '2020-01-01',
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
          releaseTimestamp: '2020-01-01',
          id: 1,
          url: 'correct/url/tag.com',
          name: 'some/dep',
          description: '',
        },
        {
          version: '1.0.1',
          releaseTimestamp: '2020-01-01',
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
          releaseTimestamp: '2020-01-01',
          id: 1,
          url: 'https://github.com/some/other-repository/releases/v1.0.0',
          name: 'some/dep',
          description: 'some body',
        },
        {
          version: 'v1.0.1',
          releaseTimestamp: '2020-01-01',
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

    it('gets release notes with body "other-"', async () => {
      githubReleasesMock.mockResolvedValueOnce([
        {
          version: 'other-1.0.0',
          releaseTimestamp: '2020-01-01',
          id: 1,
          url: 'https://github.com/some/other-repository/releases/other-1.0.0',
          name: 'some/dep',
          description: 'some body',
        },
        {
          version: 'other-1.0.1',
          releaseTimestamp: '2020-01-01',
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

    it('gets release notes with body "other_v"', async () => {
      githubReleasesMock.mockResolvedValueOnce([
        {
          version: 'other_v1.0.0',
          releaseTimestamp: '2020-01-01',
          id: 1,
          url: 'https://github.com/some/other-repository/releases/other_v1.0.0',
          name: 'some/dep',
          description: 'some body',
        },
        {
          version: 'other_v1.0.1',
          releaseTimestamp: '2020-01-01',
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
          releaseTimestamp: '2020-01-01',
          url: 'https://github.com/some/other-repository/releases/other@1.0.0',
          name: 'some/dep',
          description: 'some body',
        },
        {
          version: 'other@1.0.1',
          description:
            'some body #123, [#124](https://github.com/some/yet-other-repository/issues/124)',
          id: 2,
          releaseTimestamp: '2020-01-01',
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
          releaseTimestamp: '2020-01-01',
          url: 'correct/url/tag.com',
          name: 'some/dep',
          description: 'some body',
        },
        {
          id: 2,
          version: `someOtherRelease1/exampleDep_1.0.0`,
          releaseTimestamp: '2020-01-01',
          url: 'correct/url/tag.com',
          name: 'some/dep',
          description: 'some body',
        },
        {
          id: 3,
          version: `someOtherRelease2/exampleDep-1.0.0`,
          releaseTimestamp: '2020-01-01',
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
          releaseTimestamp: '2020-01-01',
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
      expect(res).toMatchSnapshot({
        notesSourceUrl:
          'https://github.com/angular/angular.js/blob/HEAD/CHANGELOG.md',
        url: 'https://github.com/angular/angular.js/blob/HEAD/CHANGELOG.md#169-fiery-basilisk-2018-02-02',
      });
    });

    it('parses gitlab.com/gitlab-org/gitter/webapp', async () => {
      jest.setTimeout(0);
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

      expect(res).toMatchSnapshot({
        notesSourceUrl:
          'https://gitlab.com/gitlab-org/gitter/webapp/blob/HEAD/CHANGELOG.md',
        url: 'https://gitlab.com/gitlab-org/gitter/webapp/blob/HEAD/CHANGELOG.md#20260---2020-05-18',
      });
    });

    it('parses self hosted gitlab', async () => {
      hostRules.find.mockReturnValue({ token: 'some-token' });
      jest.setTimeout(0);
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

      expect(res).toMatchSnapshot({
        notesSourceUrl:
          'https://my.custom.domain/gitlab-org/gitter/webapp/blob/HEAD/CHANGELOG.md',
        url: 'https://my.custom.domain/gitlab-org/gitter/webapp/blob/HEAD/CHANGELOG.md#20260---2020-05-18',
      });
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

      expect(res).toMatchSnapshot({
        notesSourceUrl:
          'https://github.com/facebook/jest/blob/HEAD/CHANGELOG.md',
        url: 'https://github.com/facebook/jest/blob/HEAD/CHANGELOG.md#jest-2200',
      });
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

      expect(res).toMatchSnapshot({
        notesSourceUrl:
          'https://github.com/nodeca/js-yaml/blob/HEAD/packages/foo/CHANGELOG.md',
        url: 'https://github.com/nodeca/js-yaml/blob/HEAD/packages/foo/CHANGELOG.md#3100--2017-09-10',
      });
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

      expect(res).toMatchSnapshot({
        notesSourceUrl:
          'https://github.com/nodeca/js-yaml/blob/HEAD/CHANGELOG.md',
        url: 'https://github.com/nodeca/js-yaml/blob/HEAD/CHANGELOG.md#3100--2017-09-10',
      });
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

        expect(res).toMatchSnapshot({
          notesSourceUrl:
            'https://github.com/yargs/yargs/blob/HEAD/CHANGELOG.md',
          url: 'https://github.com/yargs/yargs/blob/HEAD/CHANGELOG.md#1530-2020-03-08',
        });
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

        expect(res).toMatchSnapshot({
          notesSourceUrl:
            'https://github.com/yargs/yargs/blob/HEAD/CHANGELOG.md',
          url: 'https://github.com/yargs/yargs/blob/HEAD/CHANGELOG.md#1520-2020-03-01',
        });
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

        expect(res).toMatchSnapshot({
          notesSourceUrl:
            'https://gitlab.com/itentialopensource/adapter-utils/blob/HEAD/CHANGELOG.md',
          url: 'https://gitlab.com/itentialopensource/adapter-utils/blob/HEAD/CHANGELOG.md#4330-05-15-2020',
        });
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

        expect(res).toMatchSnapshot({
          notesSourceUrl:
            'https://gitlab.com/itentialopensource/adapter-utils/blob/HEAD/packages/foo/CHANGELOG.md',
          url: 'https://gitlab.com/itentialopensource/adapter-utils/blob/HEAD/packages/foo/CHANGELOG.md#4330-05-15-2020',
        });
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

    describe('shouldSkipChangelogMd', () => {
      it('should skip for flagged repository', () => {
        expect(shouldSkipChangelogMd('facebook/react-native')).toBeTrue();
      });

      it('should continue for other repository', () => {
        expect(shouldSkipChangelogMd('some/repo')).toBeFalse();
      });
    });
  });
});
