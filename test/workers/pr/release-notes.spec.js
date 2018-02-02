const ghGot = require('gh-got');
const { getReleaseNotes } = require('../../../lib/workers/pr/release-notes');

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
});
