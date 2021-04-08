import { Readable } from 'stream';
import {
  getBranchNameWithoutRefsheadsPrefix,
  getGitStatusContextCombinedName,
  getGitStatusContextFromCombinedName,
  getNewBranchName,
  getRenovatePRFormat,
  streamToString,
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

  describe('getGitStatusContextCombinedName', () => {
    it('should return undefined if null context passed', () => {
      const contextName = getGitStatusContextCombinedName(null);
      expect(contextName).toBeUndefined();
    });
    it('should combine valid genre and name with slash', () => {
      const contextName = getGitStatusContextCombinedName({
        genre: 'my-genre',
        name: 'status-name',
      });
      expect(contextName).toMatch('my-genre/status-name');
    });
    it('should combine valid empty genre and name without a slash', () => {
      const contextName = getGitStatusContextCombinedName({
        genre: undefined,
        name: 'status-name',
      });
      expect(contextName).toMatch('status-name');
    });
  });

  describe('getGitStatusContextFromCombinedName', () => {
    it('should return undefined if null context passed', () => {
      const context = getGitStatusContextFromCombinedName(null);
      expect(context).toBeUndefined();
    });
    it('should parse valid genre and name with slash', () => {
      const context = getGitStatusContextFromCombinedName(
        'my-genre/status-name'
      );
      expect(context).toEqual({
        genre: 'my-genre',
        name: 'status-name',
      });
    });
    it('should parse valid genre and name with multiple slashes', () => {
      const context = getGitStatusContextFromCombinedName(
        'my-genre/sub-genre/status-name'
      );
      expect(context).toEqual({
        genre: 'my-genre/sub-genre',
        name: 'status-name',
      });
    });
    it('should parse valid empty genre and name without a slash', () => {
      const context = getGitStatusContextFromCombinedName('status-name');
      expect(context).toEqual({
        genre: undefined,
        name: 'status-name',
      });
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

  describe('streamToString', () => {
    it('converts Readable stream to string', async () => {
      const res = await streamToString(Readable.from('foobar'));
      expect(res).toEqual('foobar');
    });
    it('handles error', async () => {
      const stream = Readable.from('foobar');
      const res = streamToString(stream);
      stream.destroy(new Error('some unknown error'));
      await expect(res).rejects.toThrow('some unknown error');
    });
  });
});
