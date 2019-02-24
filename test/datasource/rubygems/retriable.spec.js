const retriable = require('../../../lib/datasource/rubygems/retriable.js');

describe('datasource/rubygems/retriable', () => {
  const { RENOVATE_RUBYGEMS_RETRY_DELAY_STEP } = process.env;

  beforeEach(() => {
    process.env.RENOVATE_RUBYGEMS_RETRY_DELAY_STEP = 1;
  });

  it('returns 0 when numberOfRetries equals 0', () => {
    expect(retriable(0)()).toEqual(0);
  });

  it('returns retry after header + 1 second if request is banned', () => {
    expect(
      retriable(1)(null, {
        statusCode: 429,
        headers: { 'retry-after': 5 },
      })
    ).toEqual(6);

    expect(
      retriable(1)(null, {
        statusCode: 503,
        headers: { 'retry-after': 9 },
      })
    ).toEqual(10);
  });

  it('returns default delay if request is not banned', () => {
    expect(retriable(1)(null, { statusCode: 500 })).toEqual(5);
  });

  it('uses default numberOfRetries', () => {
    expect(retriable()(null, { statusCode: 500 })).toEqual(1);
  });

  afterEach(() => {
    process.env.RENOVATE_RUBYGEMS_RETRY_DELAY_STEP = RENOVATE_RUBYGEMS_RETRY_DELAY_STEP;
  });
});
