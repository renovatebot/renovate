import { DevboxSchema } from './schema';

describe('modules/manager/devbox/schema', () => {
  it('parses devbox.json with empty packages', () => {
    expect(DevboxSchema.parse({ packages: {} })).toEqual({
      packages: [],
    });
  });

  it.each([
    [
      'parses devbox.json with packages record',
      { packages: { foo: '1.2.3' } },
      { packages: { foo: '1.2.3', bar: '1.2.3' } },
    ],
    [
      'parses devbox.json with packages record with version key',
      {
        packages: {
          foo: {
            version: '1.2.3',
          },
        },
      },
      {
        packages: {
          foo: {
            version: '1.2.3',
          },
          bar: {
            version: '1.2.3',
          },
        },
      },
    ],
    [
      'parses devbox.json with packages array',
      { packages: ['foo@1.2.3'] },
      { packages: ['foo@1.2.3', 'bar@1.2.3'] },
    ],
  ])('%s', (_, singleTest, multipleTest) => {
    expect(DevboxSchema.parse(singleTest)).toEqual({
      packages: [
        {
          currentValue: '1.2.3',
          datasource: 'devbox',
          depName: 'foo',
          packageName: 'foo',
        },
      ],
    });
    expect(DevboxSchema.parse(multipleTest)).toEqual({
      packages: [
        {
          currentValue: '1.2.3',
          datasource: 'devbox',
          depName: 'foo',
          packageName: 'foo',
        },
        {
          currentValue: '1.2.3',
          datasource: 'devbox',
          depName: 'bar',
          packageName: 'bar',
        },
      ],
    });
  });
});
