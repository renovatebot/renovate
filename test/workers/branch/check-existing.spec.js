const {
  prAlreadyExisted,
} = require('../../../lib/workers/branch/check-existing');
const defaultConfig = require('../../../lib/config/defaults').getConfig();
const logger = require('../../_fixtures/logger');

describe('workers/branch/check-existing', () => {
  describe('prAlreadyExisted', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        api: { checkForClosedPr: jest.fn() },
        logger,
        branchName: 'some-branch',
        prTitle: 'some-title',
      };
    });
    it('returns false if recreating closed PRs', async () => {
      config.recreateClosed = true;
      expect(await prAlreadyExisted(config)).toBe(false);
      expect(config.api.checkForClosedPr.mock.calls.length).toBe(0);
    });
    it('returns false if both checks miss', async () => {
      config.recreatedClosed = true;
      expect(await prAlreadyExisted(config)).toBe(false);
      expect(config.api.checkForClosedPr.mock.calls.length).toBe(2);
    });
    it('returns true if first check hits', async () => {
      config.api.checkForClosedPr.mockReturnValueOnce(true);
      expect(await prAlreadyExisted(config)).toBe(true);
      expect(config.api.checkForClosedPr.mock.calls.length).toBe(1);
    });
    it('returns true if second check hits', async () => {
      config.api.checkForClosedPr.mockReturnValueOnce(false);
      config.api.checkForClosedPr.mockReturnValueOnce(true);
      expect(await prAlreadyExisted(config)).toBe(true);
      expect(config.api.checkForClosedPr.mock.calls.length).toBe(2);
    });
  });
});
