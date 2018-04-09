const changelog = require('changelog');
const changelogHelper = require('../../../lib/workers/pr/changelog');

jest.mock('changelog');
jest.mock('../../../lib/datasource/npm');

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
        await changelogHelper.getChangeLogJSON('@renovate/no', '1.0.0', '3.0.0')
      ).toBe(null);
    });
    it('sorts JSON', async () => {
      changelog.generate = jest.fn(() => ({
        project: {
          github: 'chalk/chalk',
          repository: 'https://github.com/chalk/chalk',
        },
        versions: [
          {
            version: '2.3.0',
            date: '2017-10-24T04:12:55.953Z',
            changes: [
              {
                sha: '14e0aa97727019b22f0a003fdc631aeec5e2e24c',
                date: '2017-10-24T04:12:53.000Z',
                message: '2.3.0',
              },
              {
                sha: '7be154c074026f77b99e7d854b3a4cdd5e4ae502',
                date: '2017-10-24T04:02:36.000Z',
                message: 'TypeScript fixes (#217)',
              },
            ],
          },
          {
            version: '2.2.2',
            date: '2017-10-24T03:20:46.238Z',
            changes: [
              {
                sha: 'e1177ec3628f6d0d37489c1e1accd2c389a376a8',
                date: '2017-10-24T03:15:51.000Z',
                message: '2.2.2',
              },
              {
                sha: 'e2a4aa427568ff1c5d649739c4d1f8319cf0d072',
                date: '2017-10-24T03:12:34.000Z',
                message:
                  'fix .visible when called after .enable is set to false',
              },
              {
                sha: 'ede310303b9893146bd7cc24261a50e3b47c633a',
                date: '2017-10-24T03:12:16.000Z',
                message: 'add failing test for .visible bug',
              },
              {
                sha: '6adf5794a38552923ea474c4b60c372ef0582035',
                date: '2017-10-24T02:46:10.000Z',
                message: '2.2.1',
              },
              {
                sha: 'dc092b4a5f5ca77dd1e22607cdf2fdd388803064',
                date: '2017-10-24T02:44:46.000Z',
                message:
                  'Add .visible for emitting text only when enabled (fixes #192)',
              },
              {
                sha: '4372d27f7eb887c4d33cdca1f9484f321ceab3dd',
                date: '2017-10-22T08:20:23.000Z',
                message: 'Add Awesome mentioned badge',
              },
            ],
          },
        ],
      }));
      expect(
        await changelogHelper.getChangeLogJSON('chalk', '2.2.2', '2.3.0')
      ).toMatchSnapshot();
    });
  });
});
