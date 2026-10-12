import { HttpCache } from './schema.ts';

describe('util/http/cache/schema', () => {
  const timestamp = '2024-06-15T00:00:00.000Z';
  const httpResponse = {
    statusCode: 200,
    headers: { etag: 'abc', 'set-cookie': ['a=1', 'b=2'] },
    body: { msg: 'Hello, world!' },
  };

  it('parses a persisted entry', () => {
    expect(
      HttpCache.parse({
        etag: 'abc',
        lastModified: 'Mon, 01 Jan 2024 00:00:00 GMT',
        httpResponse: { ...httpResponse, authorization: false, cached: true },
        timestamp,
      }),
    ).toEqual({
      etag: 'abc',
      lastModified: 'Mon, 01 Jan 2024 00:00:00 GMT',
      httpResponse: { ...httpResponse, authorization: false, cached: true },
      timestamp,
    });
  });

  it.each`
    name                            | value
    ${'undefined'}                  | ${undefined}
    ${'a string'}                   | ${'cached'}
    ${'a missing timestamp'}        | ${{ httpResponse }}
    ${'a missing response'}         | ${{ timestamp }}
    ${'a string response'}          | ${{ timestamp, httpResponse: 'cached' }}
    ${'a response without status'}  | ${{ timestamp, httpResponse: { headers: {}, body: '' } }}
    ${'a response without headers'} | ${{ timestamp, httpResponse: { statusCode: 200, body: '' } }}
    ${'a numeric header'}           | ${{ timestamp, httpResponse: { statusCode: 200, headers: { age: 1 }, body: '' } }}
  `('returns null for $name', ({ value }) => {
    expect(HttpCache.parse(value)).toBeNull();
  });
});
