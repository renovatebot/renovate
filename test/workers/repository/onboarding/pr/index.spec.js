const logger = require('../../../../_fixtures/logger');
const defaultConfig = require('../../../../../lib/config/defaults').getConfig();

const {
  ensureOnboardingPr,
} = require('../../../../../lib/workers/repository/onboarding/pr');

describe('workers/repository/onboarding/pr', () => {
  describe('ensureOnboardingPr()', () => {
    let config;
    beforeEach(() => {
      jest.resetAllMocks();
      config = {
        ...defaultConfig,
        logger,
        api: {
          createPr: jest.fn(() => ({})),
          getBranchPr: jest.fn(),
          updatePr: jest.fn(),
        },
        errors: [],
        warnings: [],
        description: [],
        branches: [],
      };
    });
    let createPrBody;
    it('creates PR', async () => {
      await ensureOnboardingPr(config);
      expect(config.api.createPr.mock.calls).toHaveLength(1);
      createPrBody = config.api.createPr.mock.calls[0][2];
    });
    it('returns if PR does not need updating', async () => {
      config.api.getBranchPr.mockReturnValue({
        title: 'Configure Renovate',
        body: createPrBody,
      });
      await ensureOnboardingPr(config);
      expect(config.api.createPr.mock.calls).toHaveLength(0);
      expect(config.api.updatePr.mock.calls).toHaveLength(0);
    });
    it('updates PR', async () => {
      config.baseBranch = 'some-branch';
      config.api.getBranchPr.mockReturnValue({
        title: 'Configure Renovate',
        body: createPrBody,
      });
      await ensureOnboardingPr(config);
      expect(config.api.createPr.mock.calls).toHaveLength(0);
      expect(config.api.updatePr.mock.calls).toHaveLength(1);
    });
  });
});
