const { initRepo } = require('../../../lib/workers/repository/init');
const { determineUpdates } = require('../../../lib/workers/repository/updates');
const {
  writeUpdates,
} = require('../../../lib/workers/repository/process/write');
const {
  ensureOnboardingPr,
} = require('../../../lib/workers/repository/onboarding/pr');
const { renovateRepository } = require('../../../lib/workers/repository/index');

jest.mock('../../../lib/workers/repository/init');
jest.mock('../../../lib/workers/repository/init/apis');
jest.mock('../../../lib/workers/repository/updates');
jest.mock('../../../lib/workers/repository/onboarding/pr');
jest.mock('../../../lib/workers/repository/process/write');
jest.mock('../../../lib/workers/repository/finalise');
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
      determineUpdates.mockReturnValue({
        repoIsOnboarded: true,
        branches: [{ type: 'minor' }, { type: 'pin' }],
      });
      writeUpdates.mockReturnValueOnce('done');
      const res = await renovateRepository(config, 'some-token');
      expect(res).toMatchSnapshot();
    });
  });
});
