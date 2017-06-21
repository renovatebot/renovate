const changelog = require('changelog');
const changelogHelper = require('../../lib/helpers/changelog');
const bunyan = require('bunyan');

const logger = bunyan.createLogger({
  name: 'test',
  stream: process.stdout,
  level: 'fatal',
});

jest.mock('changelog');

describe('helpers/changelog', () => {
  describe('changelogHelper.getChangeLog(depName, fromVersion, newVersion, logger)', () => {
    it('returns empty if no fromVersion', async () => {
      expect(
        await changelogHelper.getChangeLog('renovate', null, '1.0.0', logger)
      ).toBe('No changelog available');
    });
    it('returns empty if fromVersion equals newVersion', async () => {
      expect(
        await changelogHelper.getChangeLog('renovate', '1.0.0', '1.0.0', logger)
      ).toBe('No changelog available');
    });
    it('returns empty if generated json is null', async () => {
      changelog.generate.mockReturnValueOnce(null);
      expect(
        await changelogHelper.getChangeLog('renovate', '1.0.0', '2.0.0', logger)
      ).toBe('No changelog available');
    });
    it('returns header if generated markdown is valid', async () => {
      changelog.generate.mockReturnValueOnce({});
      changelog.markdown.mockReturnValueOnce('dummy');
      expect(
        await changelogHelper.getChangeLog('renovate', '1.0.0', '2.0.0', logger)
      ).toBe('### Changelog\n\ndummy');
    });
    it('returns empty if error thrown', async () => {
      changelog.generate = jest.fn(() => {
        throw new Error('foo');
      });
      expect(
        await changelogHelper.getChangeLog('renovate', '1.0.0', '2.0.0', logger)
      ).toBe('No changelog available');
    });
  });
});
