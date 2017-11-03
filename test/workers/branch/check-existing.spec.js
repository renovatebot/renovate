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
        api: { findPr: jest.fn(), updatePr: jest.fn() },
        logger,
        branchName: 'some-branch',
        prTitle: 'some-title',
      };
    });
    it('returns false if recreating closed PRs', async () => {
      config.recreateClosed = true;
      expect(await prAlreadyExisted(config)).toBe(null);
      expect(config.api.findPr.mock.calls.length).toBe(0);
    });
    it('returns false if both checks miss', async () => {
      config.recreatedClosed = true;
      expect(await prAlreadyExisted(config)).toBe(null);
      expect(config.api.findPr.mock.calls.length).toBe(2);
    });
    it('returns true if first check hits', async () => {
      config.api.findPr.mockReturnValueOnce({ number: 12 });
      expect(await prAlreadyExisted(config)).toEqual({ number: 12 });
      expect(config.api.findPr.mock.calls.length).toBe(1);
    });
    it('returns true if second check hits', async () => {
      config.api.findPr.mockReturnValueOnce(null);
      config.api.findPr.mockReturnValueOnce({ number: 13 });
      expect(await prAlreadyExisted(config)).toEqual({ number: 13 });
      expect(config.api.findPr.mock.calls.length).toBe(2);
    });
    it('returns false if mistaken', async () => {
      config.api.findPr.mockReturnValueOnce({
        title: 'some title',
        closed_at: '2017-10-15T21:28:07.000Z',
      });
      expect(await prAlreadyExisted(config)).toBe(null);
      expect(config.api.updatePr.mock.calls).toHaveLength(1);
    });
  });
});
