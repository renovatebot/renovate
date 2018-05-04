const { initRepo } = require('../../../lib/workers/repository/init');
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
jest.mock('delay');

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = require('../../_fixtures/config');
});

describe('workers/repository', () => {
  describe('renovateRepository()', () => {
    it('writes', async () => {
      initRepo.mockReturnValue({});
      writeUpdates.mockReturnValueOnce('done');
      const res = await renovateRepository(config, 'some-token');
      expect(res).toMatchSnapshot();
    });
    it('ensures onboarding pr', async () => {
      initRepo.mockReturnValue({});
      ensureOnboardingPr.mockReturnValue('onboarding');
      const res = await renovateRepository(config, 'some-token');
      expect(res).toMatchSnapshot();
      expect(ensureOnboardingPr.mock.calls[0][0].branches).toMatchSnapshot();
    });
    it('handles baseBranches', async () => {
      initRepo.mockReturnValue({ baseBranches: ['master', 'next'] });
      writeUpdates.mockReturnValueOnce('done');
      const res = await renovateRepository(config, 'some-token');
      expect(res).toMatchSnapshot();
    });
  });
});
