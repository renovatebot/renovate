import retriable from '../../../lib/datasource/rubygems/retriable';

describe('datasource/rubygems/retriable', () => {
  const { RENOVATE_RUBYGEMS_RETRY_DELAY_STEP } = process.env;
  let err: Error;

  beforeEach(() => {
    process.env.RENOVATE_RUBYGEMS_RETRY_DELAY_STEP = '1';
    err = new Error();
  });

  it('returns 0 when numberOfRetries equals 0', () => {
    expect(retriable(0)()).toEqual(0);
  });

  it('returns retry after header + 1 second if request is banned', () => {
    expect(
      retriable(1)(
        null,
        Object.assign(err, {
          statusCode: 429,
          headers: { 'retry-after': '5' },
        })
      )
    ).toEqual(6);

    expect(
      retriable(1)(
        null,
        Object.assign(err, {
          statusCode: 503,
          headers: { 'retry-after': '9' },
        })
      )
    ).toEqual(10);
  });

  it('returns default delay if request is not banned', () => {
    expect(retriable(1)(null, Object.assign(err, { statusCode: 500 }))).toEqual(
      5
    );
  });

  it('uses default numberOfRetries', () => {
    expect(retriable()(null, Object.assign(err, { statusCode: 500 }))).toEqual(
      1
    );
  });

  afterEach(() => {
    process.env.RENOVATE_RUBYGEMS_RETRY_DELAY_STEP = RENOVATE_RUBYGEMS_RETRY_DELAY_STEP;
  });
});
