import { MemoryRepoCache } from './memory';

describe('util/cache/repository/impl/memory', () => {
  it('returns empty object on creation', () => {
    const cache = new MemoryRepoCache();
    expect(cache.getData()).toBeEmpty();
  });

  it('does not lose data on load', async () => {
    const cache = new MemoryRepoCache();
    const data = cache.getData();
    data.semanticCommits = 'enabled';
    expect(cache.getData()).toEqual(data);

    await cache.load();
    expect(cache.getData()).toEqual(data);
  });

  it('does not persist data on save', async () => {
    const cache = new MemoryRepoCache();
    const data = cache.getData();
    data.semanticCommits = 'enabled';
    await cache.save();

    const newCache = new MemoryRepoCache();
    await newCache.load();
    expect(newCache.getData()).toBeEmpty();
  });
});
