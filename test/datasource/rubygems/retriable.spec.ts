import retriable from '../../../lib/datasource/rubygems/retriable';

describe('datasource/rubygems/retriable', () => {
  it('returns 0 when numberOfRetries equals 0', () => {
    expect(retriable(0)(null, null)).toEqual(0);
  });

  it('returns retry after header + 1 second if request is banned', () => {
    expect(
      retriable(1)(null, {
        statusCode: 429,
        headers: { 'retry-after': '5' },
      })
    ).toEqual(6000);

    expect(
      retriable(1)(null, {
        statusCode: 503,
        headers: { 'retry-after': '9' },
      })
    ).toEqual(10000);
  });

  it('returns default delay if request is not banned', () => {
    expect(retriable(1)(null, { statusCode: 500 })).toEqual(2000);
  });

  it('uses default numberOfRetries', () => {
    expect(retriable()(null, { statusCode: 500 })).toEqual(1000);
  });
});
