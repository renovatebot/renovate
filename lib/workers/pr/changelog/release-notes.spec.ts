import fs from 'fs-extra';
import { DateTime } from 'luxon';
import * as httpMock from '../../../../test/http-mock';
import { getName, mocked } from '../../../../test/util';
import * as _hostRules from '../../../util/host-rules';
import {
  addReleaseNotes,
  getReleaseList,
  getReleaseNotes,
  getReleaseNotesMd,
  releaseNotesCacheMinutes,
} from './release-notes';
import type { ChangeLogNotes } from './types';

jest.mock('../../../util/host-rules');

const hostRules = mocked(_hostRules);

const angularJsChangelogMd = fs.readFileSync(
  'lib/workers/pr/__fixtures__/angular-js.md',
  'utf8'
);
const jestChangelogMd = fs.readFileSync(
  'lib/workers/pr/__fixtures__/jest.md',
  'utf8'
);

const jsYamlChangelogMd = fs.readFileSync(
  'lib/workers/pr/__fixtures__/js-yaml.md',
  'utf8'
);

const yargsChangelogMd = fs.readFileSync(
  'lib/workers/pr/__fixtures__/yargs.md',
  'utf8'
);

const adapterutilsChangelogMd = fs.readFileSync(
  'lib/workers/pr/__fixtures__/adapter-utils.md',
  'utf8'
);

const gitterWebappChangelogMd = fs.readFileSync(
  'lib/workers/pr/__fixtures__/gitter-webapp.md',
  'utf8'
);

const githubTreeResponse = {
  tree: [
    { path: 'lib', type: 'tree' },
    { path: 'CHANGELOG.md', type: 'blob', sha: 'abcd' },
    { path: 'README.md', type: 'blob' },
  ],
};

const gitlabTreeResponse = [
  { path: 'lib', type: 'tree' },
  { path: 'CHANGELOG.md', type: 'blob', id: 'abcd' },
  { path: 'README.md', type: 'blob' },
];

describe(getName(__filename), () => {
  beforeEach(() => {
    httpMock.setup();
    hostRules.find.mockReturnValue({});
    hostRules.hosts.mockReturnValue([]);
  });

  afterEach(() => {
    httpMock.reset();
    jest.resetAllMocks();
  });

  describe('releaseNotesCacheMinutes', () => {
    const now = DateTime.local();
    it.each([
      [now, 55],
      [now.minus({ week: 2 }), 1435],
      [now.minus({ year: 1 }), 14495],
    ])('works with string date (%s, %i)', (date, minutes) => {
      expect(releaseNotesCacheMinutes(date?.toISO())).toEqual(minutes);
    });

    it('handles date object', () => {
      expect(releaseNotesCacheMinutes(new Date())).toEqual(55);
    });
    it.each([null, undefined, 'fake', 123])('handles invalid: %s', (date) => {
      expect(releaseNotesCacheMinutes(date as never)).toEqual(55);
    });
  });

  describe('addReleaseNotes()', () => {
    it('returns input if invalid', async () => {
      const input = { a: 1 };
      expect(await addReleaseNotes(input as never)).toEqual(input);
    });
    it('returns ChangeLogResult', async () => {
      const input = {
        a: 1,
        project: { github: 'https://github.com/nodeca/js-yaml' },
        versions: [{ version: '3.10.0', compare: { url: '' } }],
      };
      expect(await addReleaseNotes(input as never)).toMatchSnapshot();
    });
    it('returns ChangeLogResult without release notes', async () => {
      const input = {
        a: 1,
        project: { gitlab: 'https://gitlab.com/gitlab-org/gitter/webapp/' },
        versions: [{ version: '20.26.0', compare: { url: '' } }],
      };
      expect(await addReleaseNotes(input as never)).toMatchSnapshot();
    });
  });
  describe('getReleaseList()', () => {
    it('should return empty array if no apiBaseUrl', async () => {
      const res = await getReleaseList('', 'some/yet-other-repository');
      expect(res).toEqual([]);
    });
    it('should return release list for github repo', async () => {
      httpMock
        .scope('https://api.github.com/')
        .get('/repos/some/yet-other-repository/releases?per_page=100')
        .reply(200, [
          { tag_name: `v1.0.0` },
          {
            tag_name: `v1.0.1`,
            body:
              'some body #123, [#124](https://github.com/some/yet-other-repository/issues/124)',
          },
        ]);

      const res = await getReleaseList(
        'https://api.github.com/',
        'some/yet-other-repository'
      );
      expect(res).toMatchSnapshot();
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
            body:
              'some body #123, [#124](https://gitlab.com/some/yet-other-repository/issues/124)',
          },
        ]);
      const res = await getReleaseList(
        'https://gitlab.com/api/v4/',
        'some/yet-other-repository'
      );
      expect(res).toMatchSnapshot();
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
            body:
              'some body #123, [#124](https://my.custom.domain/some/yet-other-repository/issues/124)',
          },
        ]);
      const res = await getReleaseList(
        'https://my.custom.domain/api/v4/',
        'some/yet-other-repository'
      );
      expect(res).toMatchSnapshot();
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
        'some/repository',
        '1.0.0',
        'some',
        'https://github.com/',
        'https://api.github.com/'
      );
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it.each([[''], ['v'], ['other-'], ['other_v'], ['other@']])(
      'gets release notes with body',
      async (prefix) => {
        httpMock
          .scope('https://api.github.com/')
          .get('/repos/some/other-repository/releases?per_page=100')
          .reply(200, [
            { tag_name: `${prefix}1.0.0` },
            {
              tag_name: `${prefix}1.0.1`,
              body:
                'some body #123, [#124](https://github.com/some/yet-other-repository/issues/124)',
            },
          ]);
        const res = await getReleaseNotes(
          'some/other-repository',
          '1.0.1',
          'other',
          'https://github.com/',
          'https://api.github.com/'
        );
        expect(res).toMatchSnapshot();
        expect(httpMock.getTrace()).toMatchSnapshot();
      }
    );
    it.each([[''], ['v'], ['other-']])(
      'gets release notes with body from gitlab repo %s',
      async (prefix) => {
        httpMock
          .scope('https://api.gitlab.com/')
          .get('/projects/some%2fother-repository/releases?per_page=100')
          .reply(200, [
            { tag_name: `${prefix}1.0.0` },
            {
              tag_name: `${prefix}1.0.1`,
              body:
                'some body #123, [#124](https://gitlab.com/some/yet-other-repository/issues/124)',
            },
          ]);

        const res = await getReleaseNotes(
          'some/other-repository',
          '1.0.1',
          'other',
          'https://gitlab.com/',
          'https://api.gitlab.com/'
        );
        expect(res).toMatchSnapshot();
        expect(httpMock.getTrace()).toMatchSnapshot();
      }
    );
    it.each([[''], ['v'], ['other-']])(
      'gets null from repository without gitlab/github in domain %s',
      async (prefix) => {
        const res = await getReleaseNotes(
          'some/other-repository',
          '1.0.1',
          'other',
          'https://lol.lol/',
          'https://api.lol.lol/'
        );
        expect(res).toBeNull();
      }
    );
  });
  describe('getReleaseNotesMd()', () => {
    it('handles not found', async () => {
      const res = await getReleaseNotesMd(
        'chalk',
        '2.0.0',
        'https://github.com/',
        'https://api.github.com/'
      );
      expect(res).toBeNull();
    });
    it('handles files mismatch', async () => {
      httpMock
        .scope('https://api.github.com')
        .get('/repos/chalk')
        .reply(200)
        .get('/repos/chalk/git/trees/master')
        .reply(200, {
          tree: [
            { name: 'lib', type: 'tree' },
            { name: 'README.md', type: 'blob' },
          ],
        });
      const res = await getReleaseNotesMd(
        'chalk',
        '2.0.0',
        'https://github.com/',
        'https://api.github.com/'
      );
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('handles wrong format', async () => {
      httpMock
        .scope('https://api.github.com')
        .get('/repos/some/repository1')
        .reply(200)
        .get('/repos/some/repository1/git/trees/master')
        .reply(200, githubTreeResponse)
        .get('/repos/some/repository1/git/blobs/abcd')
        .reply(200, {
          content: Buffer.from('not really markdown').toString('base64'),
        });
      const res = await getReleaseNotesMd(
        'some/repository1',
        '1.0.0',
        'https://github.com/',
        'https://api.github.com/'
      );
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('handles bad markdown', async () => {
      httpMock
        .scope('https://api.github.com')
        .get('/repos/some/repository2')
        .reply(200)
        .get('/repos/some/repository2/git/trees/master')
        .reply(200, githubTreeResponse)
        .get('/repos/some/repository2/git/blobs/abcd')
        .reply(200, {
          content: Buffer.from(`#\nha\nha\n#\nha\nha`).toString('base64'),
        });
      const res = await getReleaseNotesMd(
        'some/repository2',
        '1.0.0',
        'https://github.com/',
        'https://api.github.com/'
      );
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('parses angular.js', async () => {
      httpMock
        .scope('https://api.github.com')
        .get('/repos/angular/angular.js')
        .reply(200)
        .get('/repos/angular/angular.js/git/trees/master')
        .reply(200, githubTreeResponse)
        .get('/repos/angular/angular.js/git/blobs/abcd')
        .reply(200, {
          content: Buffer.from(angularJsChangelogMd).toString('base64'),
        });
      const res = await getReleaseNotesMd(
        'angular/angular.js',
        '1.6.9',
        'https://github.com/',
        'https://api.github.com/'
      );
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
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
        'gitlab-org/gitter/webapp',
        '20.26.0',
        'https://gitlab.com/',
        'https://api.gitlab.com/'
      );
      expect(httpMock.getTrace()).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
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
        'gitlab-org/gitter/webapp',
        '20.26.0',
        'https://my.custom.domain/',
        'https://my.custom.domain/'
      );
      expect(httpMock.getTrace()).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
    });
    it('parses jest', async () => {
      httpMock
        .scope('https://api.github.com')
        .get('/repos/facebook/jest')
        .reply(200)
        .get('/repos/facebook/jest/git/trees/master')
        .reply(200, githubTreeResponse)
        .get('/repos/facebook/jest/git/blobs/abcd')
        .reply(200, {
          content: Buffer.from(jestChangelogMd).toString('base64'),
        });
      const res = await getReleaseNotesMd(
        'facebook/jest',
        '22.0.0',
        'https://github.com/',
        'https://api.github.com/'
      );
      expect(httpMock.getTrace()).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
    });
    it('parses js-yaml', async () => {
      httpMock
        .scope('https://api.github.com')
        .get('/repos/nodeca/js-yaml')
        .reply(200)
        .get('/repos/nodeca/js-yaml/git/trees/master')
        .reply(200, githubTreeResponse)
        .get('/repos/nodeca/js-yaml/git/blobs/abcd')
        .reply(200, {
          content: Buffer.from(jsYamlChangelogMd).toString('base64'),
        });
      const res = await getReleaseNotesMd(
        'nodeca/js-yaml',
        '3.10.0',
        'https://github.com/',
        'https://api.github.com/'
      );
      expect(httpMock.getTrace()).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
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
          'yargs/yargs',
          '15.3.0',
          'https://github.com/',
          'https://api.github.com/'
        );
        versionOneNotes = res;
        expect(httpMock.getTrace()).toMatchSnapshot();
        expect(res).not.toBeNull();
        expect(res).toMatchSnapshot();
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
          'yargs/yargs',
          '15.2.0',
          'https://github.com/',
          'https://api.github.com/'
        );
        versionTwoNotes = res;
        expect(httpMock.getTrace()).toMatchSnapshot();
        expect(res).not.toBeNull();
        expect(res).toMatchSnapshot();
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
          'itentialopensource/adapter-utils',
          '4.33.0',
          'https://gitlab.com/',
          'https://gitlab.com/api/v4/'
        );
        versionTwoNotes = res;
        expect(httpMock.getTrace()).toMatchSnapshot();
        expect(res).not.toBeNull();
        expect(res).toMatchSnapshot();
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
