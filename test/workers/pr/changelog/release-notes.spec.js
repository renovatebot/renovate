const fs = require('fs-extra');
const ghGot = require('gh-got');
const {
  addReleaseNotes,
  getReleaseNotes,
  getReleaseNotesMd,
} = require('../../../../lib/workers/pr/changelog/release-notes');

const angularJsChangelogMd = fs.readFileSync(
  'test/_fixtures/changelog-md/angular.js.md',
  'utf8'
);
const jestChangelogMd = fs.readFileSync(
  'test/_fixtures/changelog-md/jest.md',
  'utf8'
);

const jsYamlChangelogMd = fs.readFileSync(
  'test/_fixtures/changelog-md/js-yaml.md',
  'utf8'
);

const contentsResponse = [
  { name: 'lib' },
  { name: 'CHANGELOG.md' },
  { name: 'README.md' },
];

jest.mock('gh-got');

describe('workers/pr/release-notes', () => {
  describe('addReleaseNotes()', () => {
    it('returns input if invalid', async () => {
      const input = { a: 1 };
      expect(await addReleaseNotes(input)).toEqual(input);
    });
  });
  describe('getReleaseNotes()', () => {
    it('gets release notes', async () => {
      ghGot.mockReturnValueOnce({
        body: [{ tag_name: 'v1.0.0' }, { tag_name: 'v1.0.1' }],
      });
      const res = await getReleaseNotes(
        'some/repository',
        '1.0.0',
        'https://github.com/'
      );
      expect(res).toMatchSnapshot();
    });
    it('gets release notes with body', async () => {
      ghGot.mockReturnValueOnce({
        body: [
          { tag_name: 'v1.0.0' },
          {
            tag_name: 'v1.0.1',
            body:
              'some body #123, [#124](https://github.com/some/yet-other-repository/issues/124)',
          },
        ],
      });
      const res = await getReleaseNotes(
        'some/other-repository',
        '1.0.1',
        'https://github.com/'
      );
      expect(res).toMatchSnapshot();
    });
  });
  describe('getReleaseNotesMd()', () => {
    it('handles not found', async () => {
      const res = await getReleaseNotesMd(
        'chalk',
        '2.0.0',
        'https://github.com/'
      );
      expect(res).toBe(null);
    });
    it('handles files mismatch', async () => {
      ghGot.mockReturnValueOnce({
        body: [{ name: 'lib' }, { name: 'README.md' }],
      });
      const res = await getReleaseNotesMd(
        'chalk',
        '2.0.0',
        'https://github.com/'
      );
      expect(res).toBe(null);
    });
    it('handles wrong format', async () => {
      ghGot
        .mockReturnValueOnce({ body: contentsResponse })
        .mockReturnValueOnce({
          body: {
            content: Buffer.from('not really markdown').toString('base64'),
          },
        });
      const res = await getReleaseNotesMd(
        'some/repository1',
        '1.0.0',
        'https://github.com/'
      );
      expect(res).toBe(null);
    });
    it('handles bad markdown', async () => {
      ghGot
        .mockReturnValueOnce({ body: contentsResponse })
        .mockReturnValueOnce({
          body: {
            content: Buffer.from(`#\nha\nha\n#\nha\nha`).toString('base64'),
          },
        });
      const res = await getReleaseNotesMd(
        'some/repository2',
        '1.0.0',
        'https://github.com/'
      );
      expect(res).toBe(null);
    });
    it('parses angular.js', async () => {
      ghGot
        .mockReturnValueOnce({ body: contentsResponse })
        .mockReturnValueOnce({
          body: {
            content: Buffer.from(angularJsChangelogMd).toString('base64'),
          },
        });
      const res = await getReleaseNotesMd(
        'angular/angular.js',
        '1.6.9',
        'https://github.com/'
      );
      expect(res).not.toBe(null);
      expect(res).toMatchSnapshot();
    });
    it('parses jest', async () => {
      ghGot
        .mockReturnValueOnce({ body: contentsResponse })
        .mockReturnValueOnce({
          body: {
            content: Buffer.from(jestChangelogMd).toString('base64'),
          },
        });
      const res = await getReleaseNotesMd(
        'facebook/jest',
        '22.0.0',
        'https://github.com/'
      );
      expect(res).not.toBe(null);
      expect(res).toMatchSnapshot();
    });
    it('parses js-yaml', async () => {
      ghGot
        .mockReturnValueOnce({ body: contentsResponse })
        .mockReturnValueOnce({
          body: {
            content: Buffer.from(jsYamlChangelogMd).toString('base64'),
          },
        });
      const res = await getReleaseNotesMd(
        'nodeca/js-yaml',
        '3.10.0',
        'https://github.com/'
      );
      expect(res).not.toBe(null);
      expect(res).toMatchSnapshot();
    });
  });
});
