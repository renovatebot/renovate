import fs from 'fs-extra';
import got from '../../../util/got';
import { ChangeLogNotes } from './common';
import {
  addReleaseNotes,
  getReleaseList,
  getReleaseNotes,
  getReleaseNotesMd,
} from './release-notes';

const ghGot: jest.Mock<Promise<{ body: unknown }>> = got as never;

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

const contentsResponse = [
  { name: 'lib' },
  { name: 'CHANGELOG.md' },
  { name: 'README.md' },
];

jest.mock('../../../util/got');

describe('workers/pr/release-notes', () => {
  describe('addReleaseNotes()', () => {
    it('returns input if invalid', async () => {
      const input = { a: 1 };
      expect(await addReleaseNotes(input as never)).toEqual(input);
    });
  });
  describe('getReleaseList()', () => {
    it('should return empty array if no apiBaseUrl', async () => {
      const res = await getReleaseList('', 'some/yet-other-repository');
      expect(res).toEqual([]);
    });
    it('should return release list for github repo', async () => {
      ghGot.mockResolvedValueOnce({
        body: [
          { tag_name: `v1.0.0` },
          {
            tag_name: `v1.0.1`,
            body:
              'some body #123, [#124](https://github.com/some/yet-other-repository/issues/124)',
          },
        ],
      });
      const res = await getReleaseList(
        'https://api.github.com/',
        'some/yet-other-repository'
      );
      expect(res).toMatchSnapshot();
    });
    it('should return release list for gitlab.com project', async () => {
      ghGot.mockResolvedValueOnce({
        body: [
          { tag_name: `v1.0.0` },
          {
            tag_name: `v1.0.1`,
            body:
              'some body #123, [#124](https://gitlab.com/some/yet-other-repository/issues/124)',
          },
        ],
      });
      const res = await getReleaseList(
        'https://gitlab.com/api/v4/',
        'some/yet-other-repository'
      );
      expect(res).toMatchSnapshot();
    });
  });
  describe('getReleaseNotes()', () => {
    it('should return null for release notes without body', async () => {
      ghGot.mockResolvedValueOnce({
        body: [{ tag_name: 'v1.0.0' }, { tag_name: 'v1.0.1' }],
      });
      const res = await getReleaseNotes(
        'some/repository',
        '1.0.0',
        'some',
        'https://github.com/',
        'https://api.github.com/'
      );
      expect(res).toBeNull();
    });
    it.each([[''], ['v'], ['other-']])(
      'gets release notes with body',
      async (prefix) => {
        ghGot.mockResolvedValueOnce({
          body: [
            { tag_name: `${prefix}1.0.0` },
            {
              tag_name: `${prefix}1.0.1`,
              body:
                'some body #123, [#124](https://github.com/some/yet-other-repository/issues/124)',
            },
          ],
        });
        const res = await getReleaseNotes(
          'some/other-repository',
          '1.0.1',
          'other',
          'https://github.com/',
          'https://api.github.com/'
        );
        expect(res).toMatchSnapshot();
      }
    );
    it.each([[''], ['v'], ['other-']])(
      'gets release notes with body from gitlab repo',
      async (prefix) => {
        ghGot.mockResolvedValueOnce({
          body: [
            { tag_name: `${prefix}1.0.0` },
            {
              tag_name: `${prefix}1.0.1`,
              body:
                'some body #123, [#124](https://gitlab.com/some/yet-other-repository/issues/124)',
            },
          ],
        });
        const res = await getReleaseNotes(
          'some/other-repository',
          '1.0.1',
          'other',
          'https://gitlab.com/',
          'https://api.gitlab.com/'
        );
        expect(res).toMatchSnapshot();
      }
    );
    it.each([[''], ['v'], ['other-']])(
      'gets null from repository without gitlab/github in domain',
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
      ghGot.mockResolvedValueOnce({
        body: [{ name: 'lib' }, { name: 'README.md' }],
      });
      const res = await getReleaseNotesMd(
        'chalk',
        '2.0.0',
        'https://github.com/',
        'https://api.github.com/'
      );
      expect(res).toBeNull();
    });
    it('handles wrong format', async () => {
      ghGot
        .mockResolvedValueOnce({ body: contentsResponse })
        .mockResolvedValueOnce({
          body: {
            content: Buffer.from('not really markdown').toString('base64'),
          },
        });
      const res = await getReleaseNotesMd(
        'some/repository1',
        '1.0.0',
        'https://github.com/',
        'https://api.github.com/'
      );
      expect(res).toBeNull();
    });
    it('handles bad markdown', async () => {
      ghGot
        .mockResolvedValueOnce({ body: contentsResponse })
        .mockResolvedValueOnce({
          body: {
            content: Buffer.from(`#\nha\nha\n#\nha\nha`).toString('base64'),
          },
        });
      const res = await getReleaseNotesMd(
        'some/repository2',
        '1.0.0',
        'https://github.com/',
        'https://api.github.com/'
      );
      expect(res).toBeNull();
    });
    it('parses angular.js', async () => {
      ghGot
        .mockResolvedValueOnce({ body: contentsResponse })
        .mockResolvedValueOnce({
          body: {
            content: Buffer.from(angularJsChangelogMd).toString('base64'),
          },
        });
      const res = await getReleaseNotesMd(
        'angular/angular.js',
        '1.6.9',
        'https://github.com/',
        'https://api.github.com/'
      );
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
    });
    it('parses jest', async () => {
      ghGot
        .mockResolvedValueOnce({ body: contentsResponse })
        .mockResolvedValueOnce({
          body: {
            content: Buffer.from(jestChangelogMd).toString('base64'),
          },
        });
      const res = await getReleaseNotesMd(
        'facebook/jest',
        '22.0.0',
        'https://github.com/',
        'https://api.github.com/'
      );
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
    });
    it('parses js-yaml', async () => {
      ghGot
        .mockResolvedValueOnce({ body: contentsResponse })
        .mockResolvedValueOnce({
          body: {
            content: Buffer.from(jsYamlChangelogMd).toString('base64'),
          },
        });
      const res = await getReleaseNotesMd(
        'nodeca/js-yaml',
        '3.10.0',
        'https://github.com/',
        'https://api.github.com/'
      );
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
    });
    describe('ReleaseNotes Correctness', () => {
      let versionOneNotes: ChangeLogNotes;
      let versionTwoNotes: ChangeLogNotes;
      it('parses yargs 15.3.0', async () => {
        ghGot
          .mockResolvedValueOnce({ body: contentsResponse })
          .mockResolvedValueOnce({
            body: {
              content: Buffer.from(yargsChangelogMd).toString('base64'),
            },
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
      });
      it('parses yargs 15.2.0', async () => {
        ghGot
          .mockResolvedValueOnce({ body: contentsResponse })
          .mockResolvedValueOnce({
            body: {
              content: Buffer.from(yargsChangelogMd).toString('base64'),
            },
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
