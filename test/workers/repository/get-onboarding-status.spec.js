const getOnboardingStatus = require('../../../lib/workers/repository/get-onboarding-status');
const bunyan = require('bunyan');

const logger = bunyan.createLogger({
  name: 'test',
  stream: process.stdout,
  level: 'fatal',
});

describe('workers/repository/get-onboarding-status', () => {
  describe('getOnboardingStatus(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        api: {
          findPr: jest.fn(),
        },
        logger,
      };
    });
    it('returns complete if onboarding is false', async () => {
      config.onboarding = false;
      const res = await getOnboardingStatus(config);
      expect(res).toEqual('complete');
      expect(config.api.findPr.mock.calls.length).toBe(0);
    });
    it('returns complete if renovate onboarded', async () => {
      config.renovateOnboarded = true;
      const res = await getOnboardingStatus(config);
      expect(res).toEqual('complete');
      expect(config.api.findPr.mock.calls.length).toBe(0);
    });
    it('returns complete if pr and pr is closed', async () => {
      config.api.findPr.mockReturnValueOnce({ isClosed: true });
      const res = await getOnboardingStatus(config);
      expect(res).toEqual('complete');
      expect(config.api.findPr.mock.calls.length).toBe(1);
    });
    it('returns in progres if pr and pr is not closed', async () => {
      config.api.findPr.mockReturnValueOnce({});
      const res = await getOnboardingStatus(config);
      expect(res).toEqual('in progress');
      expect(config.api.findPr.mock.calls.length).toBe(1);
    });
    it('returns none if no pr', async () => {
      const res = await getOnboardingStatus(config);
      expect(res).toEqual('none');
      expect(config.api.findPr.mock.calls.length).toBe(1);
    });
  });
});
