const {
  prAlreadyExisted,
} = require('../../../lib/workers/branch/check-existing');
const defaultConfig = require('../../../lib/config/defaults').getConfig();

describe('workers/branch/check-existing', () => {
  describe('prAlreadyExisted', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        branchName: 'some-branch',
        prTitle: 'some-title',
      };
      jest.resetAllMocks();
    });
    it('returns false if recreating closed PRs', async () => {
      config.recreateClosed = true;
      expect(await prAlreadyExisted(config)).toBe(null);
      expect(platform.findPr.mock.calls.length).toBe(0);
    });
    it('returns false if check misses', async () => {
      config.recreatedClosed = true;
      expect(await prAlreadyExisted(config)).toBe(null);
      expect(platform.findPr.mock.calls.length).toBe(1);
    });
    it('returns true if first check hits', async () => {
      platform.findPr.mockReturnValueOnce({ number: 12 });
      platform.getPr.mockReturnValueOnce({ number: 12, state: 'closed' });
      expect(await prAlreadyExisted(config)).toEqual({ number: 12 });
      expect(platform.findPr.mock.calls.length).toBe(1);
    });
  });
});
