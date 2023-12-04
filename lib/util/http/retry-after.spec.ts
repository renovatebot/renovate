import { RequestError } from 'got';
import { getRetryAfter, wrapWithRetry } from './retry-after';

function requestError(
  response: {
    statusCode?: number;
    headers?: Record<string, string | string[]>;
  } | null = null,
) {
  const err = new RequestError('request error', {}, null as never);
  if (response) {
    (err as any).response = response;
  }
  return err;
}

describe('util/http/retry-after', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('wrapWithRetry', () => {
    it('works', async () => {
      const task = jest.fn(() => Promise.resolve(42));
      const res = await wrapWithRetry(task, 'foobar', () => null, 60);
      expect(res).toBe(42);
      expect(task).toHaveBeenCalledTimes(1);
    });

    it('throws', async () => {
      const task = jest.fn(() => Promise.reject(new Error('error')));

      await expect(
        wrapWithRetry(task, 'http://example.com', () => null, 60),
      ).rejects.toThrow('error');

      expect(task).toHaveBeenCalledTimes(1);
    });

    it('retries', async () => {
      const task = jest
        .fn()
        .mockRejectedValueOnce(new Error('error-1'))
        .mockRejectedValueOnce(new Error('error-2'))
        .mockResolvedValueOnce(42);

      const p = wrapWithRetry(task, 'http://example.com', () => 1, 60);
      await jest.advanceTimersByTimeAsync(2000);

      const res = await p;
      expect(res).toBe(42);
      expect(task).toHaveBeenCalledTimes(3);
    });

    it('gives up after max retries', async () => {
      const task = jest
        .fn()
        .mockRejectedValueOnce('error-1')
        .mockRejectedValueOnce('error-2')
        .mockRejectedValueOnce('error-3')
        .mockRejectedValue('error-4');

      const p = wrapWithRetry(task, 'http://example.com', () => 1, 60).catch(
        (err) => err,
      );
      await jest.advanceTimersByTimeAsync(2000);

      await expect(p).resolves.toBe('error-3');
      expect(task).toHaveBeenCalledTimes(3);
    });

    it('gives up when delay exceeds maxRetryAfter', async () => {
      const task = jest.fn().mockRejectedValue('error');

      const p = wrapWithRetry(task, 'http://example.com', () => 61, 60).catch(
        (err) => err,
      );

      await expect(p).resolves.toBe('error');
      expect(task).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRetryAfter', () => {
    it('returns null for non-RequestError', () => {
      expect(getRetryAfter(new Error())).toBeNull();
    });

    it('returns null for RequestError without response', () => {
      expect(getRetryAfter(requestError())).toBeNull();
    });

    it('returns null for status other than 429', () => {
      const err = new RequestError('request-error', {}, null as never);
      (err as any).response = { statusCode: 302 };
      expect(getRetryAfter(requestError({ statusCode: 302 }))).toBeNull();
    });

    it('returns null missing "retry-after" header', () => {
      expect(
        getRetryAfter(requestError({ statusCode: 429, headers: {} })),
      ).toBeNull();
    });

    it('returns null for non-integer "retry-after" header', () => {
      expect(
        getRetryAfter(
          requestError({
            statusCode: 429,
            headers: {
              'retry-after': 'Wed, 21 Oct 2015 07:28:00 GMT',
            },
          }),
        ),
      ).toBeNull();
    });

    it('returns delay in seconds from date', () => {
      jest.setSystemTime(new Date('2020-01-01T00:00:00Z'));
      expect(
        getRetryAfter(
          requestError({
            statusCode: 429,
            headers: {
              'retry-after': 'Wed, 01 Jan 2020 00:00:42 GMT',
            },
          }),
        ),
      ).toBe(42);
    });

    it('returns delay in seconds from number', () => {
      expect(
        getRetryAfter(
          requestError({
            statusCode: 429,
            headers: {
              'retry-after': '42',
            },
          }),
        ),
      ).toBe(42);
    });

    it('returns null for invalid header value', () => {
      expect(
        getRetryAfter(
          requestError({
            statusCode: 429,
            headers: {
              'retry-after': 'invalid',
            },
          }),
        ),
      ).toBeNull();
    });
  });
});
