import { mocked } from '../../../../test/util';
import * as _packageCache from '../../../util/cache/package';
import type { DockerHubCacheData } from './dockerhub-cache';
import { DockerHubCache } from './dockerhub-cache';
import type { DockerHubTag } from './schema';

jest.mock('../../../util/cache/package');
const packageCache = mocked(_packageCache);

function oldCacheData(): DockerHubCacheData {
  return {
    items: {
      1: {
        id: 1,
        last_updated: '2022-01-01',
        name: '1',
        tag_last_pushed: '2022-01-01',
        digest: 'sha256:111',
      },
      2: {
        id: 2,
        last_updated: '2022-01-02',
        name: '2',
        tag_last_pushed: '2022-01-02',
        digest: 'sha256:222',
      },
      3: {
        id: 3,
        last_updated: '2022-01-03',
        name: '3',
        tag_last_pushed: '2022-01-03',
        digest: 'sha256:333',
      },
    },
    updatedAt: '2022-01-01',
  };
}

function newItem(): DockerHubTag {
  return {
    id: 4,
    last_updated: '2022-01-04',
    name: '4',
    tag_last_pushed: '2022-01-04',
    digest: 'sha256:444',
  };
}

function newCacheData(): DockerHubCacheData {
  const { items } = oldCacheData();
  const item = newItem();
  return {
    items: {
      ...items,
      [item.id]: item,
    },
    updatedAt: '2022-01-04',
  };
}

describe('modules/datasource/docker/dockerhub-cache', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  const dockerRepository = 'foo/bar';

  it('initializes empty cache', async () => {
    packageCache.get.mockResolvedValue(undefined);

    const res = await DockerHubCache.init(dockerRepository);

    expect(res).toEqual({
      dockerRepository,
      cache: {
        items: {},
        updatedAt: null,
      },
      isChanged: false,
      reconciledIds: new Set(),
    });
  });

  it('initializes cache with data', async () => {
    const oldCache = oldCacheData();
    packageCache.get.mockResolvedValue(oldCache);

    const res = await DockerHubCache.init(dockerRepository);

    expect(res).toEqual({
      dockerRepository,
      cache: oldCache,
      isChanged: false,
      reconciledIds: new Set(),
    });
  });

  it('reconciles new items', async () => {
    const oldCache = oldCacheData();
    const newCache = newCacheData();

    packageCache.get.mockResolvedValue(oldCache);
    const cache = await DockerHubCache.init(dockerRepository);
    const newItems: DockerHubTag[] = [newItem()];

    const needNextPage = cache.reconcile(newItems, 4);

    expect(needNextPage).toBe(true);
    expect(cache).toEqual({
      cache: newCache,
      dockerRepository: 'foo/bar',
      isChanged: true,
      reconciledIds: new Set([4]),
    });

    const res = cache.getItems();
    expect(res).toEqual(Object.values(newCache.items));

    await cache.save();
    expect(packageCache.set).toHaveBeenCalledWith(
      'datasource-docker-hub-cache',
      'foo/bar',
      newCache,
      3 * 60 * 24 * 30,
    );
  });

  it('reconciles existing items', async () => {
    const oldCache = oldCacheData();

    packageCache.get.mockResolvedValue(oldCache);
    const cache = await DockerHubCache.init(dockerRepository);
    const items: DockerHubTag[] = Object.values(oldCache.items);

    const needNextPage = cache.reconcile(items, 3);

    expect(needNextPage).toBe(false);
    expect(cache).toEqual({
      cache: oldCache,
      dockerRepository: 'foo/bar',
      isChanged: false,
      reconciledIds: new Set([1, 2, 3]),
    });

    const res = cache.getItems();
    expect(res).toEqual(items);

    await cache.save();
    expect(packageCache.set).not.toHaveBeenCalled();
  });

  it('asks for the next page if the expected count does not match cached items', async () => {
    const oldCache = oldCacheData();

    packageCache.get.mockResolvedValue(oldCache);
    const cache = await DockerHubCache.init(dockerRepository);
    const items: DockerHubTag[] = Object.values(oldCache.items);

    const needNextPage = cache.reconcile(items, 0);

    expect(needNextPage).toBe(true);
    expect(cache).toEqual({
      cache: oldCache,
      dockerRepository: 'foo/bar',
      isChanged: false,
      reconciledIds: new Set([1, 2, 3]),
    });

    const res = cache.getItems();
    expect(res).toEqual(items);

    await cache.save();
    expect(packageCache.set).not.toHaveBeenCalled();
  });

  it('reconciles deleted items', async () => {
    const oldCache = oldCacheData();

    packageCache.get.mockResolvedValue(oldCache);
    const cache = await DockerHubCache.init(dockerRepository);
    const items: DockerHubTag[] = [oldCache.items[1], oldCache.items[3]];

    const needNextPage = cache.reconcile(items, 2);

    expect(needNextPage).toBe(false);

    const res = cache.getItems();
    expect(res).toEqual(items);

    await cache.save();
    expect(packageCache.set).toHaveBeenCalled();
  });

  it('reconciles from empty cache', async () => {
    const item = newItem();
    const expectedCache = {
      items: {
        [item.id]: item,
      },
      updatedAt: item.last_updated,
    };
    const cache = await DockerHubCache.init(dockerRepository);

    const needNextPage = cache.reconcile([item], 1);
    expect(needNextPage).toBe(true);
    expect(cache).toEqual({
      cache: expectedCache,
      dockerRepository: 'foo/bar',
      isChanged: true,
      reconciledIds: new Set([4]),
    });

    const res = cache.getItems();
    expect(res).toEqual([item]);

    await cache.save();
    expect(packageCache.set).toHaveBeenCalledWith(
      'datasource-docker-hub-cache',
      'foo/bar',
      expectedCache,
      3 * 60 * 24 * 30,
    );
  });
});
