import { mocked } from '../../../test/util';
import * as _repositoryCache from '../cache/repository';
import type { BranchCache, RepoCacheData } from '../cache/repository/types';
import { getCachedFile, setCachedFile } from './get-file-cache';

jest.mock('../cache/repository');
const repositoryCache = mocked(_repositoryCache);

describe('util/git/get-file-cache', () => {
  let repoCache: RepoCacheData = {};
  const defaultBranchCache: BranchCache = {
    automerge: false,
    branchName: 'some-branch',
    isModified: false,
    prNo: null,
    sha: null,
    parentSha: null,
    upgrades: [],
    contents: {},
  };

  beforeEach(() => {
    repoCache = {};
    repositoryCache.getCache.mockReturnValue(repoCache);
  });

  describe('getCachedFile', () => {
    it('returns null if cache is not populated', () => {
      expect(getCachedFile('foo', '111', 'not-existing-file')).toBeNull();
    });

    it('returns null if target SHA has changed', () => {
      repoCache.branches = [
        { ...defaultBranchCache, branchName: 'foo', sha: 'aaa' } as BranchCache,
      ];
      expect(getCachedFile('foo', '111', 'not-existing-file')).toBeNull();
    });

    it('returns null if filePath not found', () => {
      repoCache.branches = [
        {
          ...defaultBranchCache,
          branchName: 'foo',
          sha: '111',
          contents: {
            'some-file': 'some-content',
          },
        } as BranchCache,
      ];
      expect(getCachedFile('foo', '111', 'not-existing-file')).toBeNull();
    });

    it('returns null if content not cached', () => {
      repoCache.branches = [
        {
          ...defaultBranchCache,
          branchName: 'foo',
          sha: '111',
          contents: {
            'existing-file': undefined as never,
          },
        },
      ];
      expect(getCachedFile('foo', '111', 'existing-file')).toBeNull();
    });

    it('returns content', () => {
      repoCache.branches = [
        {
          ...defaultBranchCache,
          branchName: 'foo',
          sha: '111',
          contents: {
            'existing-file': 'content',
          },
        },
      ];
      expect(getCachedFile('foo', '111', 'existing-file')).toBe('content');
    });
  });

  describe('setCachedFile', () => {
    it('sets value for unpopulated cache', () => {
      setCachedFile('foo', '111', 'some-file', 'some-content');
      expect(repoCache).toEqual({
        branches: [
          {
            branchName: 'foo',
            sha: '111',
            contents: { 'some-file': 'some-content' },
          },
        ],
      });
    });

    it('replaces SHA when it has changed', () => {
      setCachedFile('foo', '111', 'some-file', 'old-content');
      setCachedFile('foo', '121', 'some-file', 'old-content');
      expect(repoCache).toEqual({
        branches: [
          {
            branchName: 'foo',
            sha: '121',
            contents: { 'some-file': 'old-content' },
          },
        ],
      });
    });

    it('replaces value and SHA when both have changed', () => {
      setCachedFile('foo', '111', 'some-file', 'old-content');
      setCachedFile('foo', '121', 'some-file', 'new-content');
      expect(repoCache).toEqual({
        branches: [
          {
            branchName: 'foo',
            sha: '121',
            contents: { 'some-file': 'new-content' },
          },
        ],
      });
    });

    it('handles multiple branches and filePaths', () => {
      setCachedFile('foo-1', '111', 'some-file', 'content');
      setCachedFile('foo-2', '121', 'some-file', 'content');
      setCachedFile('foo-3', '222', 'file-1', 'file-1-content');
      setCachedFile('foo-3', '222', 'file-2', 'file-2-content');
      expect(repoCache).toEqual({
        branches: [
          {
            branchName: 'foo-1',
            sha: '111',
            contents: { 'some-file': 'content' },
          },
          {
            branchName: 'foo-2',
            sha: '121',
            contents: { 'some-file': 'content' },
          },
          {
            branchName: 'foo-3',
            sha: '222',
            contents: {
              'file-1': 'file-1-content',
              'file-2': 'file-2-content',
            },
          },
        ],
      });
    });
  });
});
