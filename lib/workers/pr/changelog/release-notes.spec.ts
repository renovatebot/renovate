import fs from 'fs-extra';
import * as httpMock from '../../../../test/httpMock';
import { getName } from '../../../../test/util';
import { ChangeLogNotes } from './common';
import {
  addReleaseNotes,
  getReleaseList,
  getReleaseNotes,
  getReleaseNotesMd,
} from './release-notes';

const angularJsChangelogMd = fs.readFileSync(
  'lib/workers/pr/__fixtures__/angular.js.md',
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

const contentsResponse = [
  { name: 'lib' },
  { name: 'CHANGELOG.md' },
  { name: 'README.md' },
];

describe(getName(__filename), () => {
  beforeEach(() => {
    httpMock.setup();
  });

  afterEach(() => {
    httpMock.reset();
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
    it.each([[''], ['v'], ['other-']])(
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
        .get('/repos/chalk/contents/')
        .reply(200, [{ name: 'lib' }, { name: 'README.md' }]);
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
        .get('/repos/some/repository1/contents/')
        .reply(200, contentsResponse)
        .get('/repos/some/repository1/contents/CHANGELOG.md')
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
        .get('/repos/some/repository2/contents/')
        .reply(200, contentsResponse)
        .get('/repos/some/repository2/contents/CHANGELOG.md')
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
        .get('/repos/angular/angular.js/contents/')
        .reply(200, contentsResponse)
        .get('/repos/angular/angular.js/contents/CHANGELOG.md')
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
      httpMock
        .scope('https://api.gitlab.com/')
        .get('/projects/gitlab-org/gitter/webapp/repository/tree/')
        .reply(200, contentsResponse)
        .get(
          '/projects/gitlab-org/gitter/webapp/repository/files/CHANGELOG.md?ref=master'
        )
        .reply(200, {
          content: Buffer.from(gitterWebappChangelogMd).toString('base64'),
        });
      const res = await getReleaseNotesMd(
        'gitlab-org/gitter/webapp',
        '20.26.0',
        'https://gitlab.com/',
        'https://api.gitlab.com/'
      );
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('parses jest', async () => {
      httpMock
        .scope('https://api.github.com')
        .get('/repos/facebook/jest/contents/')
        .reply(200, contentsResponse)
        .get('/repos/facebook/jest/contents/CHANGELOG.md')
        .reply(200, {
          content: Buffer.from(jestChangelogMd).toString('base64'),
        });
      const res = await getReleaseNotesMd(
        'facebook/jest',
        '22.0.0',
        'https://github.com/',
        'https://api.github.com/'
      );
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('parses js-yaml', async () => {
      httpMock
        .scope('https://api.github.com')
        .get('/repos/nodeca/js-yaml/contents/')
        .reply(200, contentsResponse)
        .get('/repos/nodeca/js-yaml/contents/CHANGELOG.md')
        .reply(200, {
          content: Buffer.from(jsYamlChangelogMd).toString('base64'),
        });
      const res = await getReleaseNotesMd(
        'nodeca/js-yaml',
        '3.10.0',
        'https://github.com/',
        'https://api.github.com/'
      );
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    describe('ReleaseNotes Correctness', () => {
      let versionOneNotes: ChangeLogNotes;
      let versionTwoNotes: ChangeLogNotes;
      it('parses yargs 15.3.0', async () => {
        httpMock
          .scope('https://api.github.com')
          .get('/repos/yargs/yargs/contents/')
          .reply(200, contentsResponse)
          .get('/repos/yargs/yargs/contents/CHANGELOG.md')
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
        expect(res).not.toBeNull();
        expect(res).toMatchSnapshot();
        expect(httpMock.getTrace()).toMatchSnapshot();
      });
      it('parses yargs 15.2.0', async () => {
        httpMock
          .scope('https://api.github.com')
          .get('/repos/yargs/yargs/contents/')
          .reply(200, contentsResponse)
          .get('/repos/yargs/yargs/contents/CHANGELOG.md')
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
        expect(res).not.toBeNull();
        expect(res).toMatchSnapshot();
        expect(httpMock.getTrace()).toMatchSnapshot();
      });
      it('parses adapter-utils 4.33.0', async () => {
        httpMock
          .scope('https://gitlab.com/')
          .get(
            '/api/v4/projects/itentialopensource/adapter-utils/repository/tree/'
          )
          .reply(200, contentsResponse)
          .get(
            '/api/v4/projects/itentialopensource/adapter-utils/repository/files/CHANGELOG.md?ref=master'
          )
          .reply(200, {
            content: Buffer.from(adapterutilsChangelogMd).toString('base64'),
          });
        const res = await getReleaseNotesMd(
          'itentialopensource/adapter-utils',
          '4.33.0',
          'https://gitlab.com/',
          'https://gitlab.com/api/v4/'
        );
        versionTwoNotes = res;
        expect(res).not.toBeNull();
        expect(res).toMatchSnapshot();
        expect(httpMock.getTrace()).toMatchSnapshot();
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
