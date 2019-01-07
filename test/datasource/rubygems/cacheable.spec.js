const cacheable = require('../../../lib/datasource/rubygems/cacheable.js');

describe('datasource/rubygems/cacheable', () => {
  describe('.resetCache', () => {
    it('clears http and response caches', () => {
      cacheable.httpCache.set('foo', 'bar');
      cacheable.responseCache.set('foo', 'bar');

      expect(cacheable.httpCache.get('foo')).toEqual('bar');
      expect(cacheable.responseCache.get('foo')).toEqual('bar');

      cacheable.resetCache();

      expect(cacheable.httpCache.get('foo')).toEqual(undefined);
      expect(cacheable.responseCache.get('foo')).toEqual(undefined);
    });
  });

  describe('.resetMemCache', () => {
    it('clears response caches', () => {
      cacheable.httpCache.set('foo', 'bar');
      cacheable.responseCache.set('foo', 'bar');

      expect(cacheable.httpCache.get('foo')).toEqual('bar');
      expect(cacheable.responseCache.get('foo')).toEqual('bar');

      cacheable.resetMemCache();

      expect(cacheable.httpCache.get('foo')).toEqual('bar');
      expect(cacheable.responseCache.get('foo')).toEqual(undefined);
    });
  });

  describe('.wrap', () => {
    beforeEach(async () => {
      await global.renovateCache.rmAll();
    });

    it('caches computation result', async () => {
      const spy = jest.fn(() => Promise.resolve(true));
      const wrap = cacheable.wrap()(spy);

      expect(await wrap(123)).toBeTruthy();
      expect(await wrap(123)).toBeTruthy();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('ignores empty computation result', async () => {
      const spy = jest.fn(() => Promise.resolve(null));
      const wrap = cacheable.wrap()(spy);

      expect(await wrap(456)).toBeNull();
      expect(await wrap(456)).toBeNull();

      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('uses renovateCache', async () => {
      const ns = 'test';
      const spy = jest.fn(() => 'hello, world');
      const wrap = cacheable.wrap(ns)(spy);

      const argsHash =
        '41164c427f4cf681cc1b50eaf1a175e3574a1d015c6c90fbdaf77aea39d24086';

      await global.renovateCache.set(ns, argsHash, 'ooops', 10);

      expect(await wrap(10)).toEqual('ooops');
      expect(spy).not.toBeCalled();
    });
  });
});
