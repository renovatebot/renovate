const github = require('../../lib/datasource/github');
const ghGot = require('../../lib/platform/github/gh-got-wrapper');

jest.mock('../../lib/platform/github/gh-got-wrapper');
jest.mock('got');

describe('datasource/github', () => {
  describe('getDependency', () => {
    it('returns cleaned tags', async () => {
      const body = [
        { ref: 'refs/tags/a' },
        { ref: 'refs/tags/b' },
        { ref: 'refs/tags/1.0.0' },
        { ref: 'refs/tags/v1.1.0' },
      ];
      ghGot.mockReturnValueOnce({ headers: {}, body });
      const res = await github.getDependency('some/dep', { clean: 'true' });
      expect(res).toMatchSnapshot();
      expect(Object.keys(res.versions)).toHaveLength(2);
      expect(res.versions['1.1.0']).toBeDefined();
    });
    it('returns releases', async () => {
      const body = [
        { tag_name: 'a' },
        { tag_name: 'b' },
        { tag_name: '1.0.0' },
        { tag_name: 'v1.1.0' },
      ];
      ghGot.mockReturnValueOnce({ headers: {}, body });
      const res = await github.getDependency('some/dep', { ref: 'release' });
      expect(res).toMatchSnapshot();
      expect(Object.keys(res.versions)).toHaveLength(2);
      expect(res.versions['v1.1.0']).toBeDefined();
    });
    it('returns null for invalid ref', async () => {
      expect(
        await github.getDependency('some/dep', { ref: 'invalid' })
      ).toBeNull();
    });
  });
});
