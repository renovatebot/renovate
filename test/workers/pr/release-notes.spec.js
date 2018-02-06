const fs = require('fs-extra');
const ghGot = require('gh-got');
const {
  getReleaseNotes,
  getReleaseNotesMd,
} = require('../../../lib/workers/pr/release-notes');

const angularJsChangelogMd = fs.readFileSync(
  'test/_fixtures/changelog-md/angular.js.md',
  'utf8'
);
const jestChangelogMd = fs.readFileSync(
  'test/_fixtures/changelog-md/jest.md',
  'utf8'
);

jest.mock('gh-got');

describe('workers/pr/release-notes', () => {
  describe('getReleaseNotes()', () => {
    it('gets release notes', async () => {
      ghGot.mockReturnValueOnce({
        body: [{ tag_name: 'v1.0.0' }, { tag_name: 'v1.0.1' }],
      });
      const res = await getReleaseNotes('some/repository', '1.0.0');
      expect(res).toMatchSnapshot();
    });
  });
  describe('getReleaseNotesMd()', () => {
    it('handles not found', async () => {
      const res = await getReleaseNotesMd('chalk', '2.0.0');
      expect(res).toBe(null);
    });
    it('handles wrong format', async () => {
      ghGot.mockReturnValueOnce({
        body: {
          content: Buffer.from('not really markdown').toString('base64'),
        },
      });
      const res = await getReleaseNotesMd('some/repository1', '1.0.0');
      expect(res).toBe(null);
    });
    it('handles bad markdown', async () => {
      ghGot.mockReturnValueOnce({
        body: {
          content: Buffer.from(`#\nha\nha\n#\nha\nha`).toString('base64'),
        },
      });
      const res = await getReleaseNotesMd('some/repository2', '1.0.0');
      expect(res).toBe(null);
    });
    it('parses angular.js', async () => {
      ghGot.mockReturnValueOnce({
        body: {
          content: Buffer.from(angularJsChangelogMd).toString('base64'),
        },
      });
      const res = await getReleaseNotesMd('angular/angular.js', '1.6.9');
      expect(res).not.toBe(null);
      expect(res).toMatchSnapshot();
    });
    it('parses jest', async () => {
      ghGot.mockReturnValueOnce({
        body: {
          content: Buffer.from(jestChangelogMd).toString('base64'),
        },
      });
      const res = await getReleaseNotesMd('facebook/jest', '22.0.0');
      expect(res).not.toBe(null);
      expect(res).toMatchSnapshot();
    });
  });
});
