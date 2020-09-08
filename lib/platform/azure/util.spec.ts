import {
  getBranchNameWithoutRefsheadsPrefix,
  getNewBranchName,
  getRenovatePRFormat,
} from './util';

describe('platform/azure/helpers', () => {
  describe('getNewBranchName', () => {
    it('should add refs/heads', () => {
      const res = getNewBranchName('testBB');
      expect(res).toBe(`refs/heads/testBB`);
    });
    it('should be the same', () => {
      const res = getNewBranchName('refs/heads/testBB');
      expect(res).toBe(`refs/heads/testBB`);
    });
  });

  describe('getBranchNameWithoutRefsheadsPrefix', () => {
    it('should be renamed', () => {
      const res = getBranchNameWithoutRefsheadsPrefix('refs/heads/testBB');
      expect(res).toBe(`testBB`);
    });
    it('should log error and return undefined', () => {
      const res = getBranchNameWithoutRefsheadsPrefix(undefined as any);
      expect(res).toBeUndefined();
    });
    it('should return the input', () => {
      const res = getBranchNameWithoutRefsheadsPrefix('testBB');
      expect(res).toBe('testBB');
    });
  });

  describe('getRenovatePRFormat', () => {
    it('should be formated (closed)', () => {
      const res = getRenovatePRFormat({ status: 2 } as any);
      expect(res).toMatchSnapshot();
    });

    it('should be formated (closed v2)', () => {
      const res = getRenovatePRFormat({ status: 3 } as any);
      expect(res).toMatchSnapshot();
    });

    it('should be formated (not closed)', () => {
      const res = getRenovatePRFormat({ status: 1 } as any);
      expect(res).toMatchSnapshot();
    });

    it('should be formated (isConflicted)', () => {
      const res = getRenovatePRFormat({ mergeStatus: 2 } as any);
      expect(res).toMatchSnapshot();
    });
  });
});
