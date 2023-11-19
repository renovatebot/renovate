import { RequestError } from 'got';
import { extractRetryAfterHeaderSeconds, wrapWithRetry } from './retry-after';

describe('util/http/retry-after', () => {
  describe('wrapWithRetry', () => {
    beforeEach(() => {
      jest.useFakeTimers({ advanceTimers: true });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('works', async () => {
      const task = jest.fn(() => Promise.resolve(42));
      const res = await wrapWithRetry('http://example.com', task, () => null);
      expect(res).toBe(42);
      expect(task).toHaveBeenCalledTimes(1);
    });

    it('throws', async () => {
      const task = jest.fn(() => Promise.reject(new Error('foo')));

      await expect(
        wrapWithRetry('http://example.com', task, () => null),
      ).rejects.toThrow('foo');

      expect(task).toHaveBeenCalledTimes(1);
    });

    it('retries', async () => {
      const task = jest
        .fn()
        .mockRejectedValueOnce(new Error('foo'))
        .mockRejectedValueOnce(new Error('bar'))
        .mockResolvedValueOnce(42);

      const p = wrapWithRetry('http://example.com', task, () => 1);
      await jest.advanceTimersByTimeAsync(2000);

      const res = await p;
      expect(res).toBe(42);
      expect(task).toHaveBeenCalledTimes(3);
    });

    it('gives up after max retries', async () => {
      const task = jest
        .fn()
        .mockRejectedValueOnce('foo')
        .mockRejectedValueOnce('bar')
        .mockRejectedValueOnce('baz')
        .mockRejectedValue('qux');

      const p = wrapWithRetry('http://example.com', task, () => 1).catch(
        (err) => err,
      );
      await jest.advanceTimersByTimeAsync(2000);

      await expect(p).resolves.toBe('baz');
      expect(task).toHaveBeenCalledTimes(3);
    });
  });

  describe('extractRetryAfterHeaderSeconds', () => {
    it('returns null for non-RequestError', () => {
      expect(extractRetryAfterHeaderSeconds(new Error())).toBeNull();
    });

    it('returns null for RequestError without response', () => {
      expect(
        extractRetryAfterHeaderSeconds(
          new RequestError('foo', {}, null as never),
        ),
      ).toBeNull();
    });

    it('returns null for status other than 429', () => {
      const err = new RequestError('foo', {}, null as never);
      (err as any).response = { statusCode: 302 };
      expect(extractRetryAfterHeaderSeconds(err)).toBeNull();
    });

    it('returns null missing "retry-after" header', () => {
      const err = new RequestError('foo', {}, null as never);
      (err as any).response = { statusCode: 429, headers: {} };
      expect(extractRetryAfterHeaderSeconds(err)).toBeNull();
    });

    it('returns null for non-integer "retry-after" header', () => {
      const err = new RequestError('foo', {}, null as never);
      (err as any).response = {
        statusCode: 429,
        headers: {
          'retry-after': 'Wed, 21 Oct 2015 07:28:00 GMT',
        },
      };
      expect(extractRetryAfterHeaderSeconds(err)).toBeNull();
    });

    it('returns delay in seconds', () => {
      const err = new RequestError('foo', {}, null as never);
      (err as any).response = {
        statusCode: 429,
        headers: {
          'retry-after': '42',
        },
      };
      expect(extractRetryAfterHeaderSeconds(err)).toBe(42);
    });
  });
});
