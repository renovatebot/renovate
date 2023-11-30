import { RequestError } from 'got';
import * as hostRules from '../host-rules';
import { extractRetryAfterHeaderSeconds, wrapWithRetry } from './retry-after';

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
      const task = jest.fn(() => Promise.reject(new Error('error')));

      await expect(
        wrapWithRetry('http://example.com', task, () => null),
      ).rejects.toThrow('error');

      expect(task).toHaveBeenCalledTimes(1);
    });

    it('retries', async () => {
      const task = jest
        .fn()
        .mockRejectedValueOnce(new Error('error-1'))
        .mockRejectedValueOnce(new Error('error-2'))
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
        .mockRejectedValueOnce('error-1')
        .mockRejectedValueOnce('error-2')
        .mockRejectedValueOnce('error-3')
        .mockRejectedValue('error-4');

      const p = wrapWithRetry('http://example.com', task, () => 1).catch(
        (err) => err,
      );
      await jest.advanceTimersByTimeAsync(2000);

      await expect(p).resolves.toBe('error-3');
      expect(task).toHaveBeenCalledTimes(3);
    });

    it('gives up when delay exceeds maxRetryAfter', async () => {
      const task = jest.fn().mockRejectedValue('error');

      const p = wrapWithRetry('http://example.com', task, () => 61).catch(
        (err) => err,
      );

      await expect(p).resolves.toBe('error');
      expect(task).toHaveBeenCalledTimes(1);
    });
  });

  describe('extractRetryAfterHeaderSeconds', () => {
    it('returns null for non-RequestError', () => {
      expect(extractRetryAfterHeaderSeconds(new Error())).toBeNull();
    });

    it('returns null for RequestError without response', () => {
      expect(extractRetryAfterHeaderSeconds(requestError())).toBeNull();
    });

    it('returns null for status other than 429', () => {
      const err = new RequestError('request-error', {}, null as never);
      (err as any).response = { statusCode: 302 };
      expect(
        extractRetryAfterHeaderSeconds(requestError({ statusCode: 302 })),
      ).toBeNull();
    });

    it('returns null missing "retry-after" header', () => {
      expect(
        extractRetryAfterHeaderSeconds(
          requestError({ statusCode: 429, headers: {} }),
        ),
      ).toBeNull();
    });

    it('returns null for non-integer "retry-after" header', () => {
      expect(
        extractRetryAfterHeaderSeconds(
          requestError({
            statusCode: 429,
            headers: {
              'retry-after': 'Wed, 21 Oct 2015 07:28:00 GMT',
            },
          }),
        ),
      ).toBeNull();
    });

    it('returns delay in seconds', () => {
      expect(
        extractRetryAfterHeaderSeconds(
          requestError({
            statusCode: 429,
            headers: {
              'retry-after': '42',
            },
          }),
        ),
      ).toBe(42);
    });
  });
});
