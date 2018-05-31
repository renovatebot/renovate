const github = require('../../lib/datasource/github');
const ghGot = require('../../lib/platform/github/gh-got-wrapper');

jest.mock('../../lib/platform/github/gh-got-wrapper');
jest.mock('got');

describe('datasource/github', () => {
  describe('getDependency', () => {
    it('returns stripped versions', async () => {
      const body = [
        { ref: 'refs/tags/a' },
        { ref: 'refs/tags/b' },
        { ref: 'refs/tags/1.0.0' },
        { ref: 'refs/tags/v1.1.0' },
      ];
      ghGot.mockReturnValueOnce({ headers: {}, body });
      const res = await github.getDependency('some/dep');
      expect(res).toMatchSnapshot();
      expect(Object.keys(res.versions)).toHaveLength(2);
      expect(res.versions['1.1.0']).toBeDefined();
    });
  });
});
