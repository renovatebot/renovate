import { DateTime } from 'luxon';
import * as httpMock from '../../../../test/http-mock';
import { loadFixture, mocked } from '../../../../test/util';
import { clone } from '../../../util/clone';
import * as _hostRules from '../../../util/host-rules';
import {
  addReleaseNotes,
  getReleaseList,
  getReleaseNotes,
  getReleaseNotesMd,
  releaseNotesCacheMinutes,
} from './release-notes';
import type {
  ChangeLogNotes,
  ChangeLogProject,
  ChangeLogRelease,
  ChangeLogResult,
} from './types';

jest.mock('../../../util/host-rules');

const hostRules = mocked(_hostRules);

const angularJsChangelogMd = loadFixture('angular-js.md', '..');
const jestChangelogMd = loadFixture('jest.md', '..');
const jsYamlChangelogMd = loadFixture('js-yaml.md', '..');
const yargsChangelogMd = loadFixture('yargs.md', '..');
const adapterutilsChangelogMd = loadFixture('adapter-utils.md', '..');
const gitterWebappChangelogMd = loadFixture('gitter-webapp.md', '..');

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

const githubProject = {
  type: 'github',
  apiBaseUrl: 'https://api.github.com/',
  baseUrl: 'https://github.com/',
} as ChangeLogProject;

const gitlabProject = {
  type: 'gitlab',
  apiBaseUrl: 'https://gitlab.com/api/v4/',
  baseUrl: 'https://gitlab.com/',
} as ChangeLogProject;

describe('workers/pr/changelog/release-notes', () => {
  beforeEach(() => {
    hostRules.find.mockReturnValue({});
    hostRules.hosts.mockReturnValue([]);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('releaseNotesCacheMinutes', () => {
    const now = DateTime.local();
    it.each([
      [now, 55],
      [now.minus({ weeks: 2 }), 1435],
      [now.minus({ years: 1 }), 14495],
    ])('works with string date (%s, %i)', (date, minutes) => {
      expect(releaseNotesCacheMinutes(date?.toISO())).toEqual(minutes);
    });

    it('handles date object', () => {
      expect(releaseNotesCacheMinutes(new Date())).toBe(55);
    });

    it.each([null, undefined, 'fake', 123])('handles invalid: %s', (date) => {
      expect(releaseNotesCacheMinutes(date as never)).toBe(55);
    });
  });

  describe('addReleaseNotes()', () => {
    it('returns input if invalid', async () => {
      const input = { a: 1 };
      expect(await addReleaseNotes(input as never)).toEqual(input);
      expect(await addReleaseNotes(null)).toBeNull();
      expect(await addReleaseNotes({ versions: [] } as never)).toStrictEqual({
        versions: [],
      });
    });

    it('returns ChangeLogResult', async () => {
      const input = {
        a: 1,
        project: {
          type: 'github',
          repository: 'https://github.com/nodeca/js-yaml',
        },
        versions: [{ version: '3.10.0', compare: { url: '' } }],
      };
      expect(await addReleaseNotes(input as never)).toEqual({
        a: 1,
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
      const input = {
        a: 1,
        project: {
          type: 'gitlab',
          repository: 'https://gitlab.com/gitlab-org/gitter/webapp/',
        } as ChangeLogProject,
        versions: [
          { version: '20.26.0', compare: { url: '' } } as ChangeLogRelease,
        ],
      } as ChangeLogResult;
      expect(await addReleaseNotes(input)).toEqual({
        a: 1,
        hasReleaseNotes: false,
        project: {
          repository: 'https://gitlab.com/gitlab-org/gitter/webapp/',
          type: 'gitlab',
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
      const res = await getReleaseList({} as ChangeLogProject);
      expect(res).toBeEmptyArray();
    });

    it('should return release list for github repo', async () => {
      httpMock
        .scope('https://api.github.com/')
        .get('/repos/some/yet-other-repository/releases?per_page=100')
        .reply(200, [
          { tag_name: `v1.0.0` },
          {
            tag_name: `v1.0.1`,
            body: 'some body #123, [#124](https://github.com/some/yet-other-repository/issues/124)',
          },
        ]);

      const res = await getReleaseList({
        ...githubProject,
        repository: 'some/yet-other-repository',
      });
      expect(res).toMatchSnapshot([
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
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('should return release list for gitlab.com project', async () => {
      httpMock
        .scope('https://gitlab.com/')
        .get(
          '/api/v4/projects/some%2fyet-other-repository/releases?per_page=100'
        )
        .reply(200, [
          { tag_name: `v1.0.0` },
          {
            tag_name: `v1.0.1`,
            body: 'some body #123, [#124](https://gitlab.com/some/yet-other-repository/issues/124)',
          },
        ]);
      const res = await getReleaseList({
        ...gitlabProject,
        repository: 'some/yet-other-repository',
      });
      expect(res).toMatchSnapshot([
        {
          notesSourceUrl:
            'https://gitlab.com/api/v4/projects/some%2fyet-other-repository/releases',
          tag: 'v1.0.0',
          url: 'https://gitlab.com/api/v4/projects/some%2fyet-other-repository/releases/v1.0.0',
        },
        {
          notesSourceUrl:
            'https://gitlab.com/api/v4/projects/some%2fyet-other-repository/releases',
          tag: 'v1.0.1',
          url: 'https://gitlab.com/api/v4/projects/some%2fyet-other-repository/releases/v1.0.1',
        },
      ]);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('should return release list for self hosted gitlab project', async () => {
      hostRules.find.mockReturnValue({ token: 'some-token' });
      httpMock
        .scope('https://my.custom.domain/')
        .get(
          '/api/v4/projects/some%2fyet-other-repository/releases?per_page=100'
        )
        .reply(200, [
          { tag_name: `v1.0.0` },
          {
            tag_name: `v1.0.1`,
            body: 'some body #123, [#124](https://my.custom.domain/some/yet-other-repository/issues/124)',
          },
        ]);
      const res = await getReleaseList({
        ...gitlabProject,
        repository: 'some/yet-other-repository',
        apiBaseUrl: 'https://my.custom.domain/api/v4/',
        baseUrl: 'https://my.custom.domain/',
      });
      expect(res).toMatchSnapshot([
        {
          notesSourceUrl:
            'https://my.custom.domain/api/v4/projects/some%2fyet-other-repository/releases',
          tag: 'v1.0.0',
          url: 'https://my.custom.domain/api/v4/projects/some%2fyet-other-repository/releases/v1.0.0',
        },
        {
          notesSourceUrl:
            'https://my.custom.domain/api/v4/projects/some%2fyet-other-repository/releases',
          tag: 'v1.0.1',
          url: 'https://my.custom.domain/api/v4/projects/some%2fyet-other-repository/releases/v1.0.1',
        },
      ]);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getReleaseNotes()', () => {
    it('should return null for release notes without body', async () => {
      httpMock
        .scope('https://api.github.com/')
        .get('/repos/some/repository/releases?per_page=100')
        .reply(200, [{ tag_name: 'v1.0.0' }, { tag_name: 'v1.0.1' }]);
      const res = await getReleaseNotes(
        {
          ...githubProject,
          repository: 'some/repository',
          depName: 'some',
        },
        '1.0.0'
      );
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('gets release notes with body ""', async () => {
      const prefix = '';
      httpMock
        .scope('https://api.github.com/')
        .get('/repos/some/other-repository/releases?per_page=100')
        .reply(200, [
          { tag_name: `${prefix}1.0.0` },
          {
            tag_name: `${prefix}1.0.1`,
            body: 'some body #123, [#124](https://github.com/some/yet-other-repository/issues/124)',
          },
        ]);
      const res = await getReleaseNotes(
        {
          ...githubProject,
          repository: 'some/other-repository',
          depName: 'other',
        },
        '1.0.1'
      );
      expect(res).toEqual({
        body: 'some body [#123](https://github.com/some/other-repository/issues/123), [#124](https://github.com/some/yet-other-repository/issues/124)\n',
        id: undefined,
        name: undefined,
        notesSourceUrl:
          'https://api.github.com/repos/some/other-repository/releases',
        tag: '1.0.1',
        url: 'https://github.com/some/other-repository/releases/1.0.1',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('gets release notes with body "v"', async () => {
      const prefix = 'v';
      httpMock
        .scope('https://api.github.com/')
        .get('/repos/some/other-repository/releases?per_page=100')
        .reply(200, [
          { tag_name: `${prefix}1.0.0` },
          {
            tag_name: `${prefix}1.0.1`,
            body: 'some body #123, [#124](https://github.com/some/yet-other-repository/issues/124)',
          },
        ]);
      const res = await getReleaseNotes(
        {
          ...githubProject,
          repository: 'some/other-repository',
          depName: 'other',
        },
        '1.0.1'
      );
      expect(res).toEqual({
        body: 'some body [#123](https://github.com/some/other-repository/issues/123), [#124](https://github.com/some/yet-other-repository/issues/124)\n',
        id: undefined,
        name: undefined,
        notesSourceUrl:
          'https://api.github.com/repos/some/other-repository/releases',
        tag: 'v1.0.1',
        url: 'https://github.com/some/other-repository/releases/v1.0.1',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('gets release notes with body "other-"', async () => {
      const prefix = 'other-';
      httpMock
        .scope('https://api.github.com/')
        .get('/repos/some/other-repository/releases?per_page=100')
        .reply(200, [
          { tag_name: `${prefix}1.0.0` },
          {
            tag_name: `${prefix}1.0.1`,
            body: 'some body #123, [#124](https://github.com/some/yet-other-repository/issues/124)',
          },
        ]);
      const res = await getReleaseNotes(
        {
          ...githubProject,
          repository: 'some/other-repository',
          depName: 'other',
        },
        '1.0.1'
      );
      expect(res).toEqual({
        body: 'some body [#123](https://github.com/some/other-repository/issues/123), [#124](https://github.com/some/yet-other-repository/issues/124)\n',
        id: undefined,
        name: undefined,
        notesSourceUrl:
          'https://api.github.com/repos/some/other-repository/releases',
        tag: 'other-1.0.1',
        url: 'https://github.com/some/other-repository/releases/other-1.0.1',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('gets release notes with body "other_v"', async () => {
      const prefix = 'other_v';
      httpMock
        .scope('https://api.github.com/')
        .get('/repos/some/other-repository/releases?per_page=100')
        .reply(200, [
          { tag_name: `${prefix}1.0.0` },
          {
            tag_name: `${prefix}1.0.1`,
            body: 'some body #123, [#124](https://github.com/some/yet-other-repository/issues/124)',
          },
        ]);
      const res = await getReleaseNotes(
        {
          ...githubProject,
          repository: 'some/other-repository',
          depName: 'other',
        },
        '1.0.1'
      );
      expect(res).toEqual({
        body: 'some body [#123](https://github.com/some/other-repository/issues/123), [#124](https://github.com/some/yet-other-repository/issues/124)\n',
        id: undefined,
        name: undefined,
        notesSourceUrl:
          'https://api.github.com/repos/some/other-repository/releases',
        tag: 'other_v1.0.1',
        url: 'https://github.com/some/other-repository/releases/other_v1.0.1',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('gets release notes with body "other@"', async () => {
      const prefix = 'other@';
      httpMock
        .scope('https://api.github.com/')
        .get('/repos/some/other-repository/releases?per_page=100')
        .reply(200, [
          { tag_name: `${prefix}1.0.0` },
          {
            tag_name: `${prefix}1.0.1`,
            body: 'some body #123, [#124](https://github.com/some/yet-other-repository/issues/124)',
          },
        ]);
      const res = await getReleaseNotes(
        {
          ...githubProject,
          repository: 'some/other-repository',
          depName: 'other',
        },
        '1.0.1'
      );
      expect(res).toEqual({
        body: 'some body [#123](https://github.com/some/other-repository/issues/123), [#124](https://github.com/some/yet-other-repository/issues/124)\n',
        id: undefined,
        name: undefined,
        notesSourceUrl:
          'https://api.github.com/repos/some/other-repository/releases',
        tag: 'other@1.0.1',
        url: 'https://github.com/some/other-repository/releases/other@1.0.1',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('gets release notes with body from gitlab repo ""', async () => {
      const prefix = '';
      httpMock
        .scope('https://api.gitlab.com/')
        .get('/projects/some%2fother-repository/releases?per_page=100')
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
          depName: 'other',
          apiBaseUrl: 'https://api.gitlab.com/',
        },
        '1.0.1'
      );
      expect(res).toEqual({
        body: 'some body #123, [#124](https://gitlab.com/some/yet-other-repository/issues/124)',
        name: undefined,
        notesSourceUrl:
          'https://api.gitlab.com/projects/some%2fother-repository/releases',
        tag: '1.0.1',
        url: 'https://gitlab.com/some/other-repository/tags/1.0.1',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('gets release notes with body from gitlab repo "v"', async () => {
      const prefix = 'v';
      httpMock
        .scope('https://api.gitlab.com/')
        .get('/projects/some%2fother-repository/releases?per_page=100')
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
          depName: 'other',
          apiBaseUrl: 'https://api.gitlab.com/',
        },
        '1.0.1'
      );
      expect(res).toEqual({
        body: 'some body #123, [#124](https://gitlab.com/some/yet-other-repository/issues/124)',
        name: undefined,
        notesSourceUrl:
          'https://api.gitlab.com/projects/some%2fother-repository/releases',
        tag: 'v1.0.1',
        url: 'https://gitlab.com/some/other-repository/tags/v1.0.1',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('gets release notes with body from gitlab repo "other-"', async () => {
      const prefix = 'other-';
      httpMock
        .scope('https://api.gitlab.com/')
        .get('/projects/some%2fother-repository/releases?per_page=100')
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
          depName: 'other',
          apiBaseUrl: 'https://api.gitlab.com/',
        },
        '1.0.1'
      );
      expect(res).toEqual({
        body: 'some body #123, [#124](https://gitlab.com/some/yet-other-repository/issues/124)',
        name: undefined,
        notesSourceUrl:
          'https://api.gitlab.com/projects/some%2fother-repository/releases',
        tag: 'other-1.0.1',
        url: 'https://gitlab.com/some/other-repository/tags/other-1.0.1',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('gets null from repository without gitlab/github in domain', async () => {
      const res = await getReleaseNotes(
        {
          repository: 'some/repository',
          depName: 'other',
          apiBaseUrl: 'https://api.lol.lol/',
          baseUrl: 'https://lol.lol/',
        } as ChangeLogProject,
        '1.0.1'
      );
      expect(res).toBeNull();
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
        '2.0.0'
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
        '2.0.0'
      );
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
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
          content: Buffer.from('not really markdown').toString('base64'),
        });
      const res = await getReleaseNotesMd(
        {
          ...githubProject,
          repository: 'some/repository1',
        },
        '1.0.0'
      );
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
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
          content: Buffer.from(`#\nha\nha\n#\nha\nha`).toString('base64'),
        });
      const res = await getReleaseNotesMd(
        {
          ...githubProject,
          repository: 'some/repository2',
        },
        '1.0.0'
      );
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
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
          content: Buffer.from(angularJsChangelogMd).toString('base64'),
        });
      const res = await getReleaseNotesMd(
        {
          ...githubProject,
          repository: 'angular/angular.js',
        },
        '1.6.9'
      );
      expect(res).toMatchSnapshot({
        notesSourceUrl:
          'https://github.com/angular/angular.js/blob/HEAD/CHANGELOG.md',
        url: 'https://github.com/angular/angular.js/blob/HEAD/CHANGELOG.md#169-fiery-basilisk-2018-02-02',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('parses gitlab.com/gitlab-org/gitter/webapp', async () => {
      jest.setTimeout(0);
      httpMock
        .scope('https://api.gitlab.com/')
        .get(
          '/projects/gitlab-org%2fgitter%2fwebapp/repository/tree?per_page=100'
        )
        .reply(200, gitlabTreeResponse)
        .get('/projects/gitlab-org%2fgitter%2fwebapp/repository/blobs/abcd/raw')
        .reply(200, gitterWebappChangelogMd);
      const res = await getReleaseNotesMd(
        {
          ...gitlabProject,
          repository: 'gitlab-org/gitter/webapp',
          apiBaseUrl: 'https://api.gitlab.com/',
        },
        '20.26.0'
      );
      expect(httpMock.getTrace()).toMatchSnapshot();
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
          '/projects/gitlab-org%2fgitter%2fwebapp/repository/tree?per_page=100'
        )
        .reply(200, gitlabTreeResponse)
        .get('/projects/gitlab-org%2fgitter%2fwebapp/repository/blobs/abcd/raw')
        .reply(200, gitterWebappChangelogMd);
      const res = await getReleaseNotesMd(
        {
          ...gitlabProject,
          repository: 'gitlab-org/gitter/webapp',
          apiBaseUrl: 'https://my.custom.domain/',
          baseUrl: 'https://my.custom.domain/',
        },
        '20.26.0'
      );
      expect(httpMock.getTrace()).toMatchSnapshot();
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
          content: Buffer.from(jestChangelogMd).toString('base64'),
        });
      const res = await getReleaseNotesMd(
        {
          ...githubProject,
          repository: 'facebook/jest',
        },
        '22.0.0'
      );
      expect(httpMock.getTrace()).toMatchSnapshot();
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
          content: Buffer.from(jsYamlChangelogMd).toString('base64'),
        });
      const res = await getReleaseNotesMd(
        {
          ...githubProject,
          repository: 'nodeca/js-yaml',
          sourceDirectory,
        },
        '3.10.0'
      );
      expect(httpMock.getTrace()).toMatchSnapshot();
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
          content: Buffer.from(jsYamlChangelogMd).toString('base64'),
        });
      const res = await getReleaseNotesMd(
        {
          ...githubProject,
          repository: 'nodeca/js-yaml',
        },
        '3.10.0'
      );
      expect(httpMock.getTrace()).toMatchSnapshot();
      expect(res).toMatchSnapshot({
        notesSourceUrl:
          'https://github.com/nodeca/js-yaml/blob/HEAD/CHANGELOG.md',
        url: 'https://github.com/nodeca/js-yaml/blob/HEAD/CHANGELOG.md#3100--2017-09-10',
      });
    });

    it('ignores invalid', async () => {
      const res = await getReleaseNotesMd(
        {
          repository: 'nodeca/js-yaml',
        } as ChangeLogProject,
        '3.10.0'
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
            content: Buffer.from(yargsChangelogMd).toString('base64'),
          });
        const res = await getReleaseNotesMd(
          {
            ...githubProject,
            repository: 'yargs/yargs',
          },
          '15.3.0'
        );
        versionOneNotes = res;
        expect(httpMock.getTrace()).toMatchSnapshot();
        expect(res).toMatchSnapshot({
          notesSourceUrl:
            'https://github.com/yargs/yargs/blob/HEAD/CHANGELOG.md',
          url: 'https://github.com/yargs/yargs/blob/HEAD/CHANGELOG.md#1530-httpswwwgithubcomyargsyargscomparev1520v1530-2020-03-08',
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
            content: Buffer.from(yargsChangelogMd).toString('base64'),
          });
        const res = await getReleaseNotesMd(
          {
            ...githubProject,
            repository: 'yargs/yargs',
          },
          '15.2.0'
        );
        versionTwoNotes = res;
        expect(httpMock.getTrace()).toMatchSnapshot();
        expect(res).toMatchSnapshot({
          notesSourceUrl:
            'https://github.com/yargs/yargs/blob/HEAD/CHANGELOG.md',
          url: 'https://github.com/yargs/yargs/blob/HEAD/CHANGELOG.md#1520-httpswwwgithubcomyargsyargscomparev1510v1520-2020-03-01',
        });
      });

      it('parses adapter-utils 4.33.0', async () => {
        httpMock
          .scope('https://gitlab.com/')
          .get(
            '/api/v4/projects/itentialopensource%2fadapter-utils/repository/tree?per_page=100'
          )
          .reply(200, gitlabTreeResponse)
          .get(
            '/api/v4/projects/itentialopensource%2fadapter-utils/repository/blobs/abcd/raw'
          )
          .reply(200, adapterutilsChangelogMd);
        const res = await getReleaseNotesMd(
          {
            ...gitlabProject,
            repository: 'itentialopensource/adapter-utils',
          },
          '4.33.0'
        );
        versionTwoNotes = res;
        expect(httpMock.getTrace()).toMatchSnapshot();
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
            `/api/v4/projects/itentialopensource%2fadapter-utils/repository/tree?per_page=100&path=${sourceDirectory}`
          )
          .reply(200, response)
          .get(
            '/api/v4/projects/itentialopensource%2fadapter-utils/repository/blobs/abcd/raw'
          )
          .reply(200, adapterutilsChangelogMd);
        const res = await getReleaseNotesMd(
          {
            ...gitlabProject,
            repository: 'itentialopensource/adapter-utils',
            sourceDirectory,
          },
          '4.33.0'
        );
        versionTwoNotes = res;
        expect(httpMock.getTrace()).toMatchSnapshot();
        expect(res).toMatchSnapshot({
          notesSourceUrl:
            'https://gitlab.com/itentialopensource/adapter-utils/blob/HEAD/packages/foo/CHANGELOG.md',
          url: 'https://gitlab.com/itentialopensource/adapter-utils/blob/HEAD/packages/foo/CHANGELOG.md#4330-05-15-2020',
        });
      });

      it('isUrl', () => {
        expect(versionOneNotes).not.toMatchObject(versionTwoNotes);
      });

      it('15.3.0 is not equal to 15.2.0', () => {
        expect(versionOneNotes).not.toMatchObject(versionTwoNotes);
      });
    });
  });
});
