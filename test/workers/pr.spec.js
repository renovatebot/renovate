const changelog = require('changelog');
const prWorker = require('../../lib/workers/pr');

jest.mock('changelog');

describe('workers/pr', () => {
  describe('getChangeLog(depName, fromVersion, newVersion)', () => {
    it('returns empty if no fromVersion', async () => {
      expect(await prWorker.getChangeLog('renovate', null, '1.0.0')).toBe('');
    });
    it('returns empty if fromVersion equals newVersion', async () => {
      expect(await prWorker.getChangeLog('renovate', '1.0.0', '1.0.0')).toBe('');
    });
    it('returns empty if generated markdown is null', async () => {
      changelog.markdown.mockReturnValueOnce(null);
      expect(await prWorker.getChangeLog('renovate', '1.0.0', '2.0.0')).toBe('');
    });
    it('returns header if generated markdown is valid', async () => {
      changelog.markdown.mockReturnValueOnce('dummy');
      expect(await prWorker.getChangeLog('renovate', '1.0.0', '2.0.0')).toBe('### Changelog\n\ndummy');
    });
    it('returns empty if error thrown', async () => {
      changelog.markdown = jest.fn(() => {
        throw new Error('foo');
      });
      expect(await prWorker.getChangeLog('renovate', '1.0.0', '2.0.0')).toBe('');
    });
  });
});
