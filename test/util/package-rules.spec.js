const { applyPackageRules } = require('../../lib/util/package-rules');

describe('applyPackageRules()', () => {
  const config1 = {
    foo: 'bar',

    packageRules: [
      {
        packageNames: ['a', 'b'],
        x: 2,
      },
      {
        packagePatterns: ['a', 'b'],
        excludePackageNames: ['aa'],
        excludePackagePatterns: ['d'],
        y: 2,
      },
    ],
  };
  it('applies both rules for a', () => {
    const dep = {
      depName: 'a',
    };
    const res = applyPackageRules({ ...config1, ...dep });
    expect(res.x).toBe(2);
    expect(res.y).toBe(2);
  });
  it('applies both rules for b', () => {
    const dep = {
      depName: 'b',
    };
    const res = applyPackageRules({ ...config1, ...dep });
    expect(res.x).toBe(2);
    expect(res.y).toBe(2);
  });
  it('applies the second rule', () => {
    const dep = {
      depName: 'abc',
    };
    const res = applyPackageRules({ ...config1, ...dep });
    expect(res.x).toBeUndefined();
    expect(res.y).toBe(2);
  });
  it('applies the second second rule', () => {
    const dep = {
      depName: 'bc',
    };
    const res = applyPackageRules({ ...config1, ...dep });
    expect(res.x).toBeUndefined();
    expect(res.y).toBe(2);
  });
  it('excludes package name', () => {
    const dep = {
      depName: 'aa',
    };
    const res = applyPackageRules({ ...config1, ...dep });
    expect(res.x).toBeUndefined();
    expect(res.y).toBeUndefined();
  });
  it('excludes package pattern', () => {
    const dep = {
      depName: 'bcd',
    };
    const res = applyPackageRules({ ...config1, ...dep });
    expect(res.x).toBeUndefined();
    expect(res.y).toBeUndefined();
  });
  it('matches anything if missing inclusive rules', () => {
    const config = {
      packageRules: [
        {
          excludePackageNames: ['foo'],
          x: 1,
        },
      ],
    };
    const res1 = applyPackageRules({
      ...config,
      depName: 'foo',
    });
    expect(res1.x).toBeUndefined();
    const res2 = applyPackageRules({
      ...config,
      depName: 'bar',
    });
    expect(res2.x).toBeDefined();
  });
  it('supports inclusive or', () => {
    const config = {
      packageRules: [
        {
          packageNames: ['neutrino'],
          packagePatterns: ['^@neutrino\\/'],
          x: 1,
        },
      ],
    };
    const res1 = applyPackageRules({ ...config, depName: 'neutrino' });
    expect(res1.x).toBeDefined();
    const res2 = applyPackageRules({
      ...config,
      depName: '@neutrino/something',
    });
    expect(res2.x).toBeDefined();
  });
  it('filters depType', () => {
    const config = {
      packageRules: [
        {
          depTypeList: ['dependencies', 'peerDependencies'],
          packageNames: ['a'],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      depName: 'a',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBe(1);
  });
  it('filters naked depType', () => {
    const config = {
      packageRules: [
        {
          depTypeList: ['dependencies', 'peerDependencies'],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'dependencies',
      depName: 'a',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBe(1);
  });
  it('filters depType', () => {
    const config = {
      packageRules: [
        {
          depTypeList: ['dependencies', 'peerDependencies'],
          packageNames: ['a'],
          x: 1,
        },
      ],
    };
    const dep = {
      depType: 'devDependencies',
      depName: 'a',
    };
    const res = applyPackageRules({ ...config, ...dep });
    expect(res.x).toBeUndefined();
  });
  it('checks if matchCurrentVersion selector is valid and satisfies the condition on range overlap', () => {
    const config = {
      packageRules: [
        {
          packageNames: ['test'],
          matchCurrentVersion: '<= 2.0.0',
          x: 1,
        },
      ],
    };
    const res1 = applyPackageRules({
      ...config,
      ...{
        depName: 'test',
        currentValue: '^1.0.0',
        fromVersion: '1.0.3',
      },
    });
    expect(res1.x).toBeDefined();
    const res2 = applyPackageRules({
      ...config,
      ...{
        depName: 'test',
        currentValue: '^1.0.0',
      },
    });
    expect(res2.x).toBeUndefined();
  });
  it('checks if matchCurrentVersion selector is valid and satisfies the condition on pinned to range overlap', () => {
    const config = {
      packageRules: [
        {
          packageNames: ['test'],
          matchCurrentVersion: '>= 2.0.0',
          x: 1,
        },
      ],
    };
    const res1 = applyPackageRules({
      ...config,
      ...{
        depName: 'test',
        currentValue: '2.4.6',
        fromVersion: '2.4.6',
      },
    });
    expect(res1.x).toBeDefined();
  });
  it('checks if matchCurrentVersion selector works with static values', () => {
    const config = {
      packageRules: [
        {
          packageNames: ['test'],
          matchCurrentVersion: '4.6.0',
          x: 1,
        },
      ],
    };
    const res1 = applyPackageRules({
      ...config,
      ...{
        depName: 'test',
        currentValue: '4.6.0',
        fromVersion: '4.6.0',
      },
    });
    expect(res1.x).toBeDefined();
  });
  it('matches paths', () => {
    const config = {
      packageFile: 'examples/foo/package.json',
      packageRules: [
        {
          paths: ['examples/**', 'lib/'],
          x: 1,
        },
      ],
    };
    const res1 = applyPackageRules({
      ...config,
      depName: 'test',
    });
    expect(res1.x).toBeDefined();
    config.packageFile = 'package.json';
    const res2 = applyPackageRules({
      ...config,
      depName: 'test',
    });
    expect(res2.x).toBeUndefined();
    config.packageFile = 'lib/a/package.json';
    const res3 = applyPackageRules({
      ...config,
      depName: 'test',
    });
    expect(res3.x).toBeDefined();
  });
});
