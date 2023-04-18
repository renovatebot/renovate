import { BzlmodVersion, Identifier, VersionPart } from './bzlmod-version';

describe('modules/versioning/bazel-module/bzlmod-version', () => {
  describe('Identifier', () => {
    it('when all digits', () => {
      const ident = new Identifier('123');
      expect(ident.asString).toBe('123');
      expect(ident.asNumber).toBe(123);
      expect(ident.isDigitsOnly).toBe(true);
    });

    it('when not all digits', () => {
      const ident = new Identifier('foo123');
      expect(ident.asString).toBe('foo123');
      expect(ident.asNumber).toBe(0);
      expect(ident.isDigitsOnly).toBe(false);
    });

    it.each([
      { a: '1', b: '1', exp: true },
      { a: '1', b: '2', exp: false },
      { a: 'foo1', b: '1', exp: false },
      { a: 'a', b: 'a', exp: true },
      { a: 'a', b: 'b', exp: false },
    ])('$a equals $b', ({ a, b, exp }) => {
      const aIdent = new Identifier(a);
      const bIdent = new Identifier(b);
      expect(aIdent.equals(bIdent)).toBe(exp);
    });

    it.each([
      { a: '1', b: '1', exp: false },
      { a: '1', b: '2', exp: true },
      { a: '2', b: '1', exp: false },
      { a: 'foo1', b: '1', exp: false },
      { a: '1', b: 'foo1', exp: true },
      { a: 'a', b: 'b', exp: true },
      { a: 'b', b: 'a', exp: false },
    ])('$a is lessThan $b', ({ a, b, exp }) => {
      const aIdent = new Identifier(a);
      const bIdent = new Identifier(b);
      expect(aIdent.lessThan(bIdent)).toBe(exp);
    });
  });

  describe('VersionPart', () => {
    it.each([
      { vp: VersionPart.create(), exp: '' },
      { vp: VersionPart.create('1', '2', '3'), exp: '1.2.3' },
    ])('.asString', ({ vp, exp }) => {
      expect(vp.asString).toBe(exp);
    });

    it.each([
      { a: ['1', '0'], b: ['1', '0'], exp: true },
      { a: ['1', '0'], b: ['1', '1'], exp: false },
      { a: ['foo1', '0'], b: ['foo1', '0'], exp: true },
    ])('$a equals $b', ({ a, b, exp }) => {
      const avp = VersionPart.create(...a);
      const bvp = VersionPart.create(...b);
      expect(avp.equals(bvp)).toBe(exp);
    });

    it.each([
      { a: ['1', '0'], b: ['1', '0'], exp: false },
      { a: ['1', '0'], b: ['1', '1'], exp: true },
      { a: ['1', '1'], b: ['1', '0'], exp: false },
      { a: ['a'], b: ['b'], exp: true },
      { a: [], b: ['1'], exp: false },
      { a: ['1'], b: [], exp: true },
      { a: ['1', '0'], b: ['2'], exp: true },
      { a: ['2'], b: ['1', '0'], exp: false },
      { a: ['1', '9'], b: ['2', '0'], exp: true },
      { a: ['2', '0'], b: ['1', '9'], exp: false },
    ])('$a is lessThan $b', ({ a, b, exp }) => {
      const avp = VersionPart.create(...a);
      const bvp = VersionPart.create(...b);
      expect(avp.lessThan(bvp)).toBe(exp);
    });

    it.each([
      { a: [], exp: true },
      { a: ['1'], exp: false },
      { a: ['1', '0'], exp: false },
    ])('.isEmpty', ({ a, exp }) => {
      const avp = VersionPart.create(...a);
      expect(avp.isEmpty).toBe(exp);
    });
  });

  describe('BzlmodVersion', () => {
    it.each([
      { v: '1.2.3', rexp: '1.2.3', pexp: '', bexp: '' },
      { v: '', rexp: '', pexp: '', bexp: '' },
      {
        v: '1.2.3-pre.20230417.1',
        rexp: '1.2.3',
        pexp: 'pre.20230417.1',
        bexp: '',
      },
      {
        v: '1.2.3+build5',
        rexp: '1.2.3',
        pexp: '',
        bexp: 'build5',
      },
      {
        v: '1.2.3-pre.20230417.1+build5',
        rexp: '1.2.3',
        pexp: 'pre.20230417.1',
        bexp: 'build5',
      },
    ])('constructor($v)', ({ v, rexp, pexp, bexp }) => {
      const bv = new BzlmodVersion(v);
      expect(bv.release.asString).toBe(rexp);
      expect(bv.prerelease.asString).toBe(pexp);
      expect(bv.build.asString).toBe(bexp);
    });

    it.each([
      { a: '1.2.3', b: '1.2.3', ignoreBuild: undefined, exp: true },
      { a: '1.2.3', b: '1.2.4', ignoreBuild: undefined, exp: false },
      {
        a: '1.2.3',
        b: '1.2.3-pre.20230417.1',
        ignoreBuild: undefined,
        exp: false,
      },
      { a: '1.2.3', b: '1.2.3+build5', ignoreBuild: undefined, exp: false },
      { a: '1.2.3', b: '1.2.3+build5', ignoreBuild: false, exp: false },
      { a: '1.2.3', b: '1.2.3+build5', ignoreBuild: true, exp: true },
      {
        a: '1.2.3',
        b: '1.2.3-pre.20230417.1+build5',
        ignoreBuild: undefined,
        exp: false,
      },
      {
        a: '1.2.3-pre.20230417.1+build5',
        b: '1.2.3-pre.20230417.1+build5',
        ignoreBuild: undefined,
        exp: true,
      },
      {
        a: '1.2.3-pre.20230417.1+build4',
        b: '1.2.3-pre.20230417.1+build5',
        ignoreBuild: undefined,
        exp: false,
      },
      { a: '1.2.3', b: 'foo1.2.3', ignoreBuild: undefined, exp: false },
      { a: '1.2.3', b: '', ignoreBuild: undefined, exp: false },
      { a: '', b: '', ignoreBuild: undefined, exp: true },
    ])('$a equals $b', ({ a, b, ignoreBuild, exp }) => {
      const abv = new BzlmodVersion(a);
      const bbv = new BzlmodVersion(b);
      expect(abv.equals(bbv, ignoreBuild)).toBe(exp);
    });

    it.each([
      { a: '1.2.3', b: '1.2.3', exp: false },
      { a: '1.2.3', b: '1.2.4', exp: true },
      { a: '1.2.3', b: '1.2.3-pre.20230417.1', exp: false },
      { a: '1.2.3-pre.20230417.1', b: '1.2.3', exp: true },
      { a: '', b: '1.2.3', exp: false },
      { a: '1.2.3', b: '', exp: true },
      { a: '', b: '', exp: false },
      {
        a: '1.2.3-pre.20230417.1+build5',
        b: '1.2.3-pre.20230417.1+build5',
        exp: false,
      },
      // NOTE: We ignore the build value for precedence comparison per the Semver spec.
      // https://semver.org/#spec-item-10
      {
        a: '1.2.3-pre.20230417.1+build4',
        b: '1.2.3-pre.20230417.1+build5',
        exp: false,
      },
      { a: '4', b: 'a', exp: true },
      { a: 'abc', b: 'abd', exp: true },
    ])('$a is lessThan $b', ({ a, b, exp }) => {
      const abv = new BzlmodVersion(a);
      const bbv = new BzlmodVersion(b);
      expect(abv.lessThan(bbv)).toBe(exp);
    });

    it.each([
      { a: '1.2.3', b: '1.2.3', exp: 0 },
      { a: '1.2.3-pre.20230417.1', b: '1.2.3', exp: -1 },
      { a: '1.2.3', b: '1.2.3-pre.20230417.1', exp: 1 },
      { a: '2', b: '1.0', exp: 1 },
      // Tests replicated from
      // https://cs.opensource.google/bazel/bazel/+/master:src/test/java/com/google/devtools/build/lib/bazel/bzlmod/VersionTest.java
      // Empty beats everything
      { a: '', b: '1.0', exp: 1 },
      { a: '', b: '1.0+build', exp: 1 },
      { a: '', b: '1.0-pre', exp: 1 },
      { a: '', b: '1.0-pre+build-kek.lol', exp: 1 },
      // assertThat(Version.parse("2.0")).isGreaterThan(Version.parse("1.0"));
      // assertThat(Version.parse("2.0")).isGreaterThan(Version.parse("1.9"));
      // assertThat(Version.parse("11.0")).isGreaterThan(Version.parse("3.0"));
      // assertThat(Version.parse("1.0.1")).isGreaterThan(Version.parse("1.0"));
      // assertThat(Version.parse("1.0.0")).isGreaterThan(Version.parse("1.0"));
      // assertThat(Version.parse("1.0+build2"))
      //     .isEquivalentAccordingToCompareTo(Version.parse("1.0+build3"));
      // assertThat(Version.parse("1.0")).isGreaterThan(Version.parse("1.0-pre"));
      // assertThat(Version.parse("1.0"))
      //        .isEquivalentAccordingToCompareTo(Version.parse("1.0+build-notpre"));
      // Release Version
      { a: '2.0', b: '1.0', exp: 1 },
      { a: '2.0', b: '1.9', exp: 1 },
      { a: '11.0', b: '3.0', exp: 1 },
      { a: '1.0.1', b: '1.0', exp: 1 }, // Question out to Xudong and Yun
      { a: '1.0+build2', b: '1.0+build3', exp: 0 },
      { a: '1.0', b: '1.0-pre', exp: 1 },
      { a: '1.0', b: '1.0+build-notpre', exp: 0 },
    ])('defaultCompare($a, $b)', ({ a, b, exp }) => {
      const abv = new BzlmodVersion(a);
      const bbv = new BzlmodVersion(b);
      expect(BzlmodVersion.defaultCompare(abv, bbv)).toBe(exp);
    });
  });
});
