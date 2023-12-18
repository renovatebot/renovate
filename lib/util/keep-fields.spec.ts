import keepField from './keep-fields';

describe('util/keep-fields', () => {
  const allowedHeader = [/^X-/, 'foo'];
  const headers = {
    'X-Auth-Token': 'token',
    test: 'test',
    foo: 'bar',
    someheader: 'value',
  };

  it('works', () => {
    const result = keepField(headers, allowedHeader);

    expect(result).toStrictEqual({
      'X-Auth-Token': 'token',
      foo: 'bar',
    });
  });
});
