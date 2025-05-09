import type { FindPRConfig, Pr } from '../types';
import * as prCache from './pr-cache';

describe('modules/platform/gerrit/pr-cache', () => {
  const repo1 = 'some/repo1';
  const repo2 = 'some/repo2';
  const pr1: Pr = {
    number: 1,
    title: 'Test PR 1',
    sourceBranch: 'feature/one',
    targetBranch: 'main',
    state: 'open',
  };
  const pr2: Pr = {
    number: 2,
    title: 'Test PR 2',
    sourceBranch: 'feature/two',
    targetBranch: 'main',
    state: 'closed',
  };

  beforeEach(() => {
    prCache.reset();
  });

  it('should not be initialized by default', () => {
    expect(prCache.initialized(repo1)).toBe(false);
  });

  it('sets and gets PRs for a repository', () => {
    prCache.set(repo1, [pr1]);
    expect(prCache.initialized(repo1)).toBe(true);
    expect(prCache.get(repo1, 1)).toEqual(pr1);
    expect(prCache.get(repo1, 2)).toBeNull();
    expect(prCache.get(repo2, 1)).toBeUndefined();
  });

  it('overwrites cache when repository changes', () => {
    prCache.set(repo1, [pr1]);
    prCache.set(repo2, [pr2]);
    expect(prCache.get(repo1, 1)).toBeUndefined();
    expect(prCache.get(repo2, 2)).toEqual(pr2);
  });

  it('adds PRs to existing cache for same repository', () => {
    prCache.set(repo1, [pr1]);
    prCache.set(repo1, [pr2]);
    expect(prCache.get(repo1, 1)).toEqual(pr1);
    expect(prCache.get(repo1, 2)).toEqual(pr2);
  });

  it('getAll returns all PRs for a repository', () => {
    prCache.set(repo1, [pr1, pr2]);
    const all = prCache.getAll(repo1);
    expect(all).toEqual([pr1, pr2]);
    expect(prCache.getAll(repo2)).toBeUndefined();
  });

  it('getAll returns empty array if cache is empty', () => {
    prCache.set(repo1, []);
    expect(prCache.getAll(repo1)).toEqual([]);
  });

  it('find returns PRs matching config', () => {
    prCache.set(repo1, [pr1, pr2]);
    const config: FindPRConfig = { branchName: 'feature/one' };
    const found = prCache.find(repo1, config);
    expect(found).toEqual([pr1]);
  });

  it('find returns single PR if limit=1', () => {
    prCache.set(repo1, [pr1, pr2]);
    const config: FindPRConfig = { branchName: 'feature/one' };
    const found = prCache.find(repo1, config, 1);
    expect(found).toEqual(pr1);
  });

  it('find returns null if no match and limit=1', () => {
    prCache.set(repo1, [pr2]);
    const config: FindPRConfig = { branchName: 'feature/one' };
    const found = prCache.find(repo1, config, 1);
    expect(found).toBeNull();
  });

  it('reset clears the cache', () => {
    prCache.set(repo1, [pr1]);
    prCache.reset();
    expect(prCache.get(repo1, 1)).toBeUndefined();
    expect(prCache.initialized(repo1)).toBe(false);
  });
});
