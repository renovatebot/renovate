const onboarding = require('../../../lib/workers/repository/onboarding');
const logger = require('../../_fixtures/logger');

describe('lib/workers/repository/onboarding', () => {
  describe('onboardRepository(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        api: {
          commitFilesToBranch: jest.fn(),
          createPr: jest.fn(() => ({ displayNumber: 1 })),
        },
        logger,
      };
    });
    it('should commit files and create PR', async () => {
      config.platform = 'github';
      await onboarding.onboardRepository(config);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(1);
      expect(config.api.createPr.mock.calls.length).toBe(1);
      expect(
        config.api.createPr.mock.calls[0][2].indexOf('Pull Request')
      ).not.toBe(-1);
      expect(
        config.api.createPr.mock.calls[0][2].indexOf('Merge Request')
      ).toBe(-1);
      expect(config.api.commitFilesToBranch.mock.calls).toMatchSnapshot();
    });
  });
  describe('getOnboardingStatus(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        api: {
          commitFilesToBranch: jest.fn(),
          createPr: jest.fn(() => ({ displayNumber: 1 })),
          findPr: jest.fn(),
        },
        logger,
      };
    });
    it('returns true if onboarding is false', async () => {
      config.onboarding = false;
      const res = await onboarding.getOnboardingStatus(config);
      expect(res).toEqual(true);
      expect(config.api.findPr.mock.calls.length).toBe(0);
    });
    it('returns complete if renovate onboarded', async () => {
      config.renovateJsonPresent = true;
      const res = await onboarding.getOnboardingStatus(config);
      expect(res).toEqual(true);
      expect(config.api.findPr.mock.calls.length).toBe(0);
    });
    it('returns complete if pr and pr is closed', async () => {
      config.api.findPr.mockReturnValueOnce({ isClosed: true });
      const res = await onboarding.getOnboardingStatus(config);
      expect(res).toEqual(true);
      expect(config.api.findPr.mock.calls.length).toBe(1);
    });
    it('returns in progres if pr and pr is not closed', async () => {
      config.api.findPr.mockReturnValueOnce({});
      const res = await onboarding.getOnboardingStatus(config);
      expect(res).toEqual(false);
      expect(config.api.findPr.mock.calls.length).toBe(1);
    });
    it('returns none if no pr', async () => {
      const res = await onboarding.getOnboardingStatus(config);
      expect(res).toEqual(false);
      expect(config.api.findPr.mock.calls.length).toBe(1);
    });
  });
});
