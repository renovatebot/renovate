import gomod, { isPseudoVersion } from './index.ts';

describe('modules/versioning/gomod/index', () => {
  it.each`
    version                                                | expected
    ${'v0.0.0-20191109021931-daa7c04131f5'}                | ${true}
    ${'v2.0.0-20191109021931-daa7c04131f5'}                | ${true}
    ${'v1.2.4-0.20191109021931-daa7c04131f5'}              | ${true}
    ${'v1.2.3-pre.0.20191109021931-daa7c04131f5'}          | ${true}
    ${'v2.0.1-0.20191109021931-daa7c04131f5+incompatible'} | ${true}
    ${'v1.2.3-20191109021931-daa7c04131f5'}                | ${false}
    ${'v0.0.0-2019110902193-daa7c04131f5'}                 | ${false}
    ${'0.0.0-20191109021931-daa7c04131f5'}                 | ${false}
    ${'v01.0.0-20191109021931-daa7c04131f5'}               | ${false}
    ${'v1.2.3'}                                            | ${false}
    ${'v1.2.3-pre'}                                        | ${false}
    ${'v2.0.0+incompatible'}                               | ${false}
    ${'v0.0.0'}                                            | ${false}
  `('isPseudoVersion("$version") === $expected', ({ version, expected }) => {
    expect(isPseudoVersion(version)).toBe(expected);
  });

  it.each`
    version                                   | other                                     | expected
    ${'v1.2.4-0.20191109021931-daa7c04131f5'} | ${'v1.2.3'}                               | ${true}
    ${'v1.2.4'}                               | ${'v1.2.4-0.20191109021931-daa7c04131f5'} | ${true}
    ${'v1.2.4-rc.1'}                          | ${'v1.2.4-0.20191109021931-daa7c04131f5'} | ${true}
    ${'v0.0.0-20200101000000-0123456789ab'}   | ${'v0.0.0-20191109021931-daa7c04131f5'}   | ${true}
  `(
    'isGreaterThan("$version", "$other") === $expected',
    ({ version, other, expected }) => {
      expect(gomod.isGreaterThan(version, other)).toBe(expected);
    },
  );

  it.each`
    version                                 | expected
    ${'v1.2.3'}                             | ${true}
    ${'v0.0.0-20191109021931-daa7c04131f5'} | ${false}
  `('isStable("$version") === $expected', ({ version, expected }) => {
    expect(gomod.isStable(version)).toBe(expected);
  });
});
