import * as memCache from '.';
import { MemCacheBucket } from '.';

describe('getRepoCache', () => {
  it('returns undefined if not init', () => {
    expect(memCache.get('key1')).toBeUndefined();
  });
  it('sets and gets repo cache', () => {
    memCache.init();
    memCache.set('key2', 'value');
    expect(memCache.get('key2')).toEqual('value');
  });
  it('resets', () => {
    memCache.init();
    memCache.set('key3', 'value');
    memCache.reset();
    expect(memCache.get('key3')).toBeUndefined();
  });
  it('stores keys in separate buckets', () => {
    memCache.init();
    memCache.set('key', 'foo');
    memCache.set('key', 'bar', MemCacheBucket.datasource);
    expect(memCache.get('key')).toEqual('foo');
    expect(memCache.get('key', MemCacheBucket.datasource)).toEqual('bar');
  });
  it('resets buckets', () => {
    memCache.init();
    memCache.set('key', 'foo');
    memCache.set('key', 'bar', MemCacheBucket.datasource);
    memCache.reset(memCache.MemCacheBucket.datasource);
    expect(memCache.get('key')).toEqual('foo');
    expect(memCache.get('key', MemCacheBucket.datasource)).toBeUndefined();
    memCache.reset(MemCacheBucket.default);
    expect(memCache.get('key')).toBeUndefined();
  });
});
