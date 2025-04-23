import { RepoCacheNull } from './null';

describe('util/cache/repository/impl/null', () => {
  let repoCache: RepoCacheNull;

  beforeEach(() => {
    repoCache = new RepoCacheNull();
  });

  it('loads without error', async () => {
    await expect(repoCache.load()).resolves.not.toThrow();
  });

  it('saves without error', async () => {
    await expect(repoCache.save()).resolves.not.toThrow();
  });

  it('performs cleanup without error', async () => {
    await expect(repoCache.cleanup()).resolves.not.toThrow();
  });

  it('returns empty data object', () => {
    expect(repoCache.getData()).toEqual({});
  });

  it('returns undefined for isModified', () => {
    expect(repoCache.isModified()).toBeUndefined();
  });
});
