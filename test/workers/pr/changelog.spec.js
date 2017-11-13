const changelog = require('changelog');
const changelogHelper = require('../../../lib/workers/pr/changelog');

jest.mock('changelog');

describe('workers/pr/changelog', () => {
  describe('getChangeLogJSON', () => {
    it('returns null if no fromVersion', async () => {
      expect(
        await changelogHelper.getChangeLogJSON('renovate', null, '1.0.0')
      ).toBe(null);
    });
    it('returns null if fromVersion equals newVersion', async () => {
      expect(
        await changelogHelper.getChangeLogJSON('renovate', '1.0.0', '1.0.0')
      ).toBe(null);
    });
    it('logs when no JSON', async () => {
      changelog.generate = jest.fn(() => null);
      expect(
        await changelogHelper.getChangeLogJSON('renovate', '1.0.0', '1.5.0')
      ).toBe(null);
    });
    it('returns JSON', async () => {
      changelog.generate = jest.fn(() => ({ a: 1 }));
      expect(
        await changelogHelper.getChangeLogJSON('renovate', '1.0.0', '2.0.0')
      ).toMatchObject({ a: 1 });
    });
    it('returns cached JSON', async () => {
      changelog.generate = jest.fn(() => ({ a: 2 }));
      expect(
        await changelogHelper.getChangeLogJSON('renovate', '1.0.0', '2.0.0')
      ).toMatchObject({ a: 1 });
    });
    it('filters unnecessary warns', async () => {
      changelog.generate = jest.fn(() => {
        throw new Error('Unknown Github Repo');
      });
      expect(
        await changelogHelper.getChangeLogJSON('renovate', '1.0.0', '3.0.0')
      ).toBe(null);
    });
  });
});
