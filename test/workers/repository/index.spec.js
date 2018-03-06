const { initRepo } = require('../../../lib/workers/repository/init');
const { determineUpdates } = require('../../../lib/workers/repository/updates');
const { writeUpdates } = require('../../../lib/workers/repository/write');
const {
  ensureOnboardingPr,
} = require('../../../lib/workers/repository/onboarding/pr');
const { renovateRepository } = require('../../../lib/workers/repository/index');

jest.mock('../../../lib/workers/repository/init');
jest.mock('../../../lib/workers/repository/init/apis');
jest.mock('../../../lib/workers/repository/updates');
jest.mock('../../../lib/workers/repository/onboarding/pr');
jest.mock('../../../lib/workers/repository/write');
jest.mock('../../../lib/workers/repository/cleanup');
jest.mock('../../../lib/workers/repository/validate');
jest.mock('../../../lib/manager');

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = require('../../_fixtures/config');
});

describe('workers/repository', () => {
  describe('renovateRepository()', () => {
    it('exits after 6 loops', async () => {
      const res = await renovateRepository(config, 'some-token', 6);
      expect(res).toMatchSnapshot();
    });
    it('writes', async () => {
      initRepo.mockReturnValue({});
      determineUpdates.mockReturnValue({
        repoIsOnboarded: true,
        branches: [{ type: 'minor' }, { type: 'pin' }],
      });
      writeUpdates.mockReturnValueOnce('automerged');
      writeUpdates.mockReturnValueOnce('onboarded');
      const res = await renovateRepository(config, 'some-token');
      expect(res).toMatchSnapshot();
    });
    it('ensures onboarding pr', async () => {
      initRepo.mockReturnValue({});
      determineUpdates.mockReturnValue({
        repoIsOnboarded: false,
        branches: [
          {
            type: 'pin',
            prTitle: 'bbb',
          },
          {
            type: 'pin',
            prTitle: 'aaa',
          },
          {
            type: 'minor',
            prTitle: 'aaa',
          },
        ],
      });
      ensureOnboardingPr.mockReturnValue('onboarding');
      const res = await renovateRepository(config, 'some-token');
      expect(res).toMatchSnapshot();
      expect(ensureOnboardingPr.mock.calls[0][0].branches).toMatchSnapshot();
    });
    it('handles baseBranches', async () => {
      initRepo.mockReturnValue({ baseBranches: ['master', 'next'] });
      determineUpdates.mockReturnValue({
        repoIsOnboarded: true,
        branches: [],
      });
      writeUpdates.mockReturnValueOnce('automerged');
      writeUpdates.mockReturnValueOnce('onboarded');
      const res = await renovateRepository(config, 'some-token');
      expect(res).toMatchSnapshot();
    });
  });
});
