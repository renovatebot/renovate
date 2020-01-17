import fs from 'fs-extra';
import got from '../../../../lib/util/got';
import {
  addReleaseNotes,
  getReleaseNotes,
  getReleaseNotesMd,
} from '../../../../lib/workers/pr/changelog/release-notes';

const ghGot: jest.Mock<Promise<{ body: unknown }>> = got as never;

const angularJsChangelogMd = fs.readFileSync(
  'test/workers/pr/_fixtures/angular.js.md',
  'utf8'
);
const jestChangelogMd = fs.readFileSync(
  'test/workers/pr/_fixtures/jest.md',
  'utf8'
);

const jsYamlChangelogMd = fs.readFileSync(
  'test/workers/pr/_fixtures/js-yaml.md',
  'utf8'
);

const standardVersionChangelogMd = fs.readFileSync(
  'test/workers/pr/_fixtures/standard-version.md',
  'utf8'
);

const contentsResponse = [
  { name: 'lib' },
  { name: 'CHANGELOG.md' },
  { name: 'README.md' },
];

jest.mock('../../../../lib/util/got');

describe('workers/pr/release-notes', () => {
  describe('addReleaseNotes()', () => {
    it('returns input if invalid', async () => {
      const input = { a: 1 };
      expect(await addReleaseNotes(input as never)).toEqual(input);
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
      async prefix => {
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
    it.each`
      version
      ${'7.0.1'}
      ${'7.0.0'}
    `('parses standard-version version $version', async ({ version }) => {
      ghGot
        .mockResolvedValueOnce({ body: contentsResponse })
        .mockResolvedValueOnce({
          body: {
            content: Buffer.from(standardVersionChangelogMd).toString('base64'),
          },
        });
      const res = await getReleaseNotesMd(
        'conventional-changelog/standard-version',
        version,
        'https://github.com/',
        'https://api.github.com/'
      );
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
    });
    it('does not contain version 7.0.1 when parsing standard-version 7.0.0', async () => {
      ghGot
        .mockResolvedValueOnce({ body: contentsResponse })
        .mockResolvedValueOnce({
          body: {
            content: Buffer.from(standardVersionChangelogMd).toString('base64'),
          },
        });
      const res = await getReleaseNotesMd(
        'conventional-changelog/standard-version',
        '7.0.0',
        'https://github.com/',
        'https://api.github.com/'
      );
      expect(res.body).toEqual(expect.not.stringContaining('7.0.1'));
      expect(res).toMatchSnapshot();
    });
    it('contains bug fix header when parsing standard-version 7.0.1', async () => {
      ghGot
        .mockResolvedValueOnce({ body: contentsResponse })
        .mockResolvedValueOnce({
          body: {
            content: Buffer.from(standardVersionChangelogMd).toString('base64'),
          },
        });
      const res = await getReleaseNotesMd(
        'conventional-changelog/standard-version',
        '7.0.1',
        'https://github.com/',
        'https://api.github.com/'
      );
      expect(res.body).toEqual(expect.stringMatching(/bug fixes/i));
      expect(res).toMatchSnapshot();
    });
  });
});
