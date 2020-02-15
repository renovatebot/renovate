import { RetryObject, HTTPError } from 'got';
import retriable from './retriable';

const retryObject: RetryObject = {
  error: null,
  attemptCount: 1,
  computedValue: 1000,
  retryOptions: {} as any,
};

describe('datasource/rubygems/retriable', () => {
  it('returns 0 when numberOfRetries equals 0', () => {
    expect(retriable(0)(retryObject)).toEqual(0);
  });

  it('returns retry after header + 1 second if request is banned', () => {
    expect(
      retriable(1)({
        ...retryObject,
        error: new HTTPError(
          {
            statusCode: 429,
            headers: { 'retry-after': '5' },
          } as any,
          {} as any
        ),
      })
    ).toEqual(6000);

    expect(
      retriable(1)({
        ...retryObject,
        error: new HTTPError(
          {
            statusCode: 503,
            headers: { 'retry-after': '9' },
          } as any,
          {} as any
        ),
      })
    ).toEqual(10000);
  });

  it('returns default delay if request is not banned', () => {
    expect(
      retriable(1)({
        ...retryObject,
        error: new HTTPError(
          {
            statusCode: 500,
          } as any,
          {} as any
        ),
      })
    ).toEqual(2000);
  });

  it('uses default numberOfRetries', () => {
    expect(
      retriable()({
        ...retryObject,
        error: new HTTPError(
          {
            statusCode: 500,
          } as any,
          {} as any
        ),
      })
    ).toEqual(1000);
  });
});
