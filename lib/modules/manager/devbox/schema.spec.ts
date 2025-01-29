import { DevboxSchema } from './schema';

describe('modules/manager/devbox/schema', () => {
  it('parses devbox.json with empty packages', () => {
    expect(DevboxSchema.parse({ packages: {} })).toEqual({
      packages: {},
    });
  });

  it('parses devbox.json with packages record', () => {
    expect(DevboxSchema.parse({ packages: { foo: '1.2.3' } })).toEqual({
      packages: { foo: '1.2.3' },
    });
    expect(
      DevboxSchema.parse({ packages: { foo: '1.2.3', bar: '1.2.3' } }),
    ).toEqual({
      packages: { foo: '1.2.3', bar: '1.2.3' },
    });
  });

  it('parses devbox.json with packages record with named version', () => {
    expect(
      DevboxSchema.parse({
        packages: {
          foo: {
            version: '1.2.3',
          },
        },
      }),
    ).toEqual({
      packages: { foo: '1.2.3' },
    });
    expect(
      DevboxSchema.parse({
        packages: {
          foo: {
            version: '1.2.3',
          },
          bar: {
            version: '1.2.3',
          },
        },
      }),
    ).toEqual({
      packages: { foo: '1.2.3', bar: '1.2.3' },
    });
  });

  it('parses devbox.json with packages array', () => {
    expect(DevboxSchema.parse({ packages: ['foo@1.2.3'] })).toEqual({
      packages: { foo: '1.2.3' },
    });
    expect(
      DevboxSchema.parse({ packages: ['foo@1.2.3', 'bar@1.2.3'] }),
    ).toEqual({
      packages: { foo: '1.2.3', bar: '1.2.3' },
    });
  });
});
