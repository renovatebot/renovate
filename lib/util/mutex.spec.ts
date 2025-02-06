import { afterEach } from '@jest/globals';
import { acquireLock, getMutex } from './mutex';

describe('util/mutex', () => {
  describe('getMutex', () => {
    it('returns mutex with default namespace', () => {
      expect(getMutex('test')).toBeDefined();
    });
  });

  describe('acquireLock', () => {
    afterEach(() => {
      getMutex('test').release();
    });

    it('return lock function with default namespace', async () => {
      await expect(acquireLock('test')).resolves.toBeFunction();
    });

    it('should lock if already used', async () => {
      const mutex = getMutex('test');
      const releaseLock = await acquireLock('test');
      expect(mutex.isLocked()).toBeTrue();
      releaseLock();
      expect(mutex.isLocked()).toBeFalse();
    });
  });
});
