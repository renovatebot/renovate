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
    it('returns false if both checks miss', async () => {
      config.recreatedClosed = true;
      expect(await prAlreadyExisted(config)).toBe(null);
      expect(platform.findPr.mock.calls.length).toBe(2);
    });
    it('returns true if first check hits', async () => {
      platform.findPr.mockReturnValueOnce({ number: 12 });
      expect(await prAlreadyExisted(config)).toEqual({ number: 12 });
      expect(platform.findPr.mock.calls.length).toBe(1);
    });
    it('returns true if second check hits', async () => {
      platform.findPr.mockReturnValueOnce(null);
      platform.findPr.mockReturnValueOnce({ number: 13 });
      expect(await prAlreadyExisted(config)).toEqual({ number: 13 });
      expect(platform.findPr.mock.calls.length).toBe(2);
    });
    it('returns false if mistaken', async () => {
      platform.findPr.mockReturnValueOnce({
        title: 'some title',
        closed_at: '2017-10-15T21:28:07.000Z',
      });
      expect(await prAlreadyExisted(config)).toBe(null);
      expect(platform.updatePr.mock.calls).toHaveLength(1);
    });
  });
});
