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

    it.each`
      a         | b      | exp
      ${'1'}    | ${'1'} | ${true}
      ${'1'}    | ${'2'} | ${false}
      ${'foo1'} | ${'1'} | ${false}
      ${'a'}    | ${'a'} | ${true}
      ${'a'}    | ${'b'} | ${false}
    `('$a equals $b', ({ a, b, exp }) => {
      const aIdent = new Identifier(a);
      const bIdent = new Identifier(b);
      expect(aIdent.equals(bIdent)).toBe(exp);
    });

    it.each`
      a         | b         | exp
      ${'1'}    | ${'1'}    | ${false}
      ${'1'}    | ${'2'}    | ${true}
      ${'2'}    | ${'1'}    | ${false}
      ${'foo1'} | ${'1'}    | ${false}
      ${'1'}    | ${'foo1'} | ${true}
      ${'a'}    | ${'b'}    | ${true}
      ${'b'}    | ${'a'}    | ${false}
    `('$a is isLessThan $b', ({ a, b, exp }) => {
      const aIdent = new Identifier(a);
      const bIdent = new Identifier(b);
      expect(aIdent.isLessThan(bIdent)).toBe(exp);
    });
  });

  describe('VersionPart', () => {
    it.each`
      a                             | expLen | expStr
      ${[]}                         | ${0}   | ${''}
      ${['1', new Identifier('0')]} | ${2}   | ${'1.0'}
    `('VersionPart.create(...$a}', ({ a, expLen, expStr }) => {
      const vp = VersionPart.create(...a);
      expect(vp).toHaveLength(expLen);
      expect(vp.asString).toBe(expStr);
    });

    it.each`
      a                  | exp
      ${[]}              | ${''}
      ${['1', '2', '3']} | ${'1.2.3'}
    `('.asString', ({ a, exp }) => {
      const avp = VersionPart.create(...a);
      expect(avp.asString).toBe(exp);
    });

    it.each`
      a                  | exp
      ${[]}              | ${0}
      ${['2']}           | ${2}
      ${['1', '2', '3']} | ${1}
    `('.major', ({ a, exp }) => {
      const avp = VersionPart.create(...a);
      expect(avp.major).toBe(exp);
    });

    it.each`
      a                  | exp
      ${[]}              | ${0}
      ${['1', '2', '3']} | ${2}
    `('.minor', ({ a, exp }) => {
      const avp = VersionPart.create(...a);
      expect(avp.minor).toBe(exp);
    });

    it.each`
      a                  | exp
      ${[]}              | ${0}
      ${['1', '2', '3']} | ${3}
    `('.patch', ({ a, exp }) => {
      const avp = VersionPart.create(...a);
      expect(avp.patch).toBe(exp);
    });

    it.each`
      a                | b                | exp
      ${['1', '0']}    | ${['1', '0']}    | ${true}
      ${['1', '0']}    | ${['1', '1']}    | ${false}
      ${['foo1', '0']} | ${['foo1', '0']} | ${true}
    `('$a equals $b', ({ a, b, exp }) => {
      const avp = VersionPart.create(...a);
      const bvp = VersionPart.create(...b);
      expect(avp.equals(bvp)).toBe(exp);
    });

    it.each`
      a             | b             | exp
      ${['1', '0']} | ${['1', '0']} | ${false}
      ${['1', '0']} | ${['1', '1']} | ${true}
      ${['1', '1']} | ${['1', '0']} | ${false}
      ${['a']}      | ${['b']}      | ${true}
      ${[]}         | ${['1']}      | ${false}
      ${['1']}      | ${[]}         | ${true}
      ${['1', '0']} | ${['2']}      | ${true}
      ${['2']}      | ${['1', '0']} | ${false}
      ${['1', '9']} | ${['2', '0']} | ${true}
      ${['2', '0']} | ${['1', '9']} | ${false}
    `('$a is isLessThan $b', ({ a, b, exp }) => {
      const avp = VersionPart.create(...a);
      const bvp = VersionPart.create(...b);
      expect(avp.isLessThan(bvp)).toBe(exp);
    });

    it.each`
      a             | exp
      ${[]}         | ${true}
      ${['1']}      | ${false}
      ${['1', '0']} | ${false}
    `('.isEmpty', ({ a, exp }) => {
      const avp = VersionPart.create(...a);
      expect(avp.isEmpty).toBe(exp);
    });
  });

  describe('BzlmodVersion', () => {
    it.each`
      v                                | rexp       | pexp                | bexp
      ${'1.2.3'}                       | ${'1.2.3'} | ${''}               | ${''}
      ${''}                            | ${''}      | ${''}               | ${''}
      ${'1.2.3-pre.20230417.1'}        | ${'1.2.3'} | ${'pre.20230417.1'} | ${''}
      ${'1.2.3+build5'}                | ${'1.2.3'} | ${''}               | ${'build5'}
      ${'1.2.3-pre.20230417.1+build5'} | ${'1.2.3'} | ${'pre.20230417.1'} | ${'build5'}
    `('constructor($v)', ({ v, rexp, pexp, bexp }) => {
      const bv = new BzlmodVersion(v);
      expect(bv.release.asString).toBe(rexp);
      expect(bv.prerelease.asString).toBe(pexp);
      expect(bv.build.asString).toBe(bexp);
    });

    // Tests replicated from
    // https://cs.opensource.google/bazel/bazel/+/master:src/test/java/com/google/devtools/build/lib/bazel/bzlmod/VersionTest.java
    it.each`
      a
      ${'-abc'}
      ${'-1_2'}
      ${'ßážëł'}
      ${'1.0-pre?'}
      ${'1.0-pre///'}
      ${'1..0'}
      ${'1.0-pre..erp'}
    `('bad versions $a', ({ a }) => {
      expect(() => {
        new BzlmodVersion(a);
      }).toThrow();
    });

    it.each`
      a                                | b                                | ignoreBuild  | exp
      ${'1.2.3'}                       | ${'1.2.3'}                       | ${undefined} | ${true}
      ${'1.2.3'}                       | ${'1.2.4'}                       | ${undefined} | ${false}
      ${'1.2.3'}                       | ${'1.2.3-pre.20230417.1'}        | ${undefined} | ${false}
      ${'1.2.3'}                       | ${'1.2.3+build5'}                | ${undefined} | ${false}
      ${'1.2.3'}                       | ${'1.2.3+build5'}                | ${false}     | ${false}
      ${'1.2.3'}                       | ${'1.2.3+build5'}                | ${true}      | ${true}
      ${'1.2.3'}                       | ${'1.2.3-pre.20230417.1+build5'} | ${undefined} | ${false}
      ${'1.2.3-pre.20230417.1+build5'} | ${'1.2.3-pre.20230417.1+build5'} | ${undefined} | ${true}
      ${'1.2.3-pre.20230417.1+build4'} | ${'1.2.3-pre.20230417.1+build5'} | ${undefined} | ${false}
      ${'1.2.3'}                       | ${'foo1.2.3'}                    | ${undefined} | ${false}
      ${'1.2.3'}                       | ${''}                            | ${undefined} | ${false}
      ${''}                            | ${''}                            | ${undefined} | ${true}
    `('$a equals $b', ({ a, b, ignoreBuild, exp }) => {
      const abv = new BzlmodVersion(a);
      const bbv = new BzlmodVersion(b);
      expect(abv.equals(bbv, ignoreBuild)).toBe(exp);
    });

    it.each`
      a                                | b                                | exp
      ${'1.2.3'}                       | ${'1.2.3'}                       | ${false}
      ${'1.2.3'}                       | ${'1.2.4'}                       | ${true}
      ${'1.2.3'}                       | ${'1.2.3-pre.20230417.1'}        | ${false}
      ${'1.2.3-pre.20230417.1'}        | ${'1.2.3'}                       | ${true}
      ${''}                            | ${'1.2.3'}                       | ${false}
      ${'1.2.3'}                       | ${''}                            | ${true}
      ${''}                            | ${''}                            | ${false}
      ${'1.2.3-pre.20230417.1+build5'} | ${'1.2.3-pre.20230417.1+build5'} | ${false}
      ${'1.2.3-pre.20230417.1+build4'} | ${'1.2.3-pre.20230417.1+build5'} | ${false}
      ${'4'}                           | ${'a'}                           | ${true}
      ${'abc'}                         | ${'abd'}                         | ${true}
      ${'pre'}                         | ${'pre.foo'}                     | ${true}
    `('$a is isLessThan $b', ({ a, b, exp }) => {
      const abv = new BzlmodVersion(a);
      const bbv = new BzlmodVersion(b);
      expect(abv.isLessThan(bbv)).toBe(exp);
    });

    it.each`
      a          | b          | exp
      ${'1.2.3'} | ${'1.2.3'} | ${false}
      ${'1.2.3'} | ${'1.2.4'} | ${false}
      ${'1.2.4'} | ${'1.2.3'} | ${true}
    `('$a isGreaterThan $b', ({ a, b, exp }) => {
      const abv = new BzlmodVersion(a);
      const bbv = new BzlmodVersion(b);
      expect(abv.isGreaterThan(bbv)).toBe(exp);
    });

    // Tests replicated from
    // https://cs.opensource.google/bazel/bazel/+/master:src/test/java/com/google/devtools/build/lib/bazel/bzlmod/VersionTest.java
    it.each`
      a                         | b                          | exp
      ${'1.2.3'}                | ${'1.2.3'}                 | ${0}
      ${'1.2.3-pre.20230417.1'} | ${'1.2.3'}                 | ${-1}
      ${'1.2.3'}                | ${'1.2.3-pre.20230417.1'}  | ${1}
      ${'2'}                    | ${'1.0'}                   | ${1}
      ${''}                     | ${'1.0'}                   | ${1}
      ${''}                     | ${'1.0+build'}             | ${1}
      ${''}                     | ${'1.0-pre'}               | ${1}
      ${''}                     | ${'1.0-pre+build-kek.lol'} | ${1}
      ${'2.0'}                  | ${'1.0'}                   | ${1}
      ${'2.0'}                  | ${'1.9'}                   | ${1}
      ${'11.0'}                 | ${'3.0'}                   | ${1}
      ${'1.0.1'}                | ${'1.0'}                   | ${1}
      ${'1.0.0'}                | ${'1.0'}                   | ${1}
      ${'1.0+build2'}           | ${'1.0+build3'}            | ${0}
      ${'1.0'}                  | ${'1.0-pre'}               | ${1}
      ${'1.0'}                  | ${'1.0+build-notpre'}      | ${0}
      ${'1.0.patch.3'}          | ${'1.0'}                   | ${1}
      ${'1.0.patch.3'}          | ${'1.0.patch.2'}           | ${1}
      ${'1.0.patch.3'}          | ${'1.0.patch.10'}          | ${-1}
      ${'1.0.patch3'}           | ${'1.0.patch10'}           | ${1}
      ${'4'}                    | ${'a'}                     | ${-1}
      ${'abc'}                  | ${'abd'}                   | ${-1}
      ${'1.0-pre'}              | ${'1.0-are'}               | ${1}
      ${'1.0-3'}                | ${'1.0-2'}                 | ${1}
      ${'1.0-pre'}              | ${'1.0-pre.foo'}           | ${-1}
      ${'1.0-pre.3'}            | ${'1.0-pre.2'}             | ${1}
      ${'1.0-pre.10'}           | ${'1.0-pre.2'}             | ${1}
      ${'1.0-pre.10a'}          | ${'1.0-pre.2a'}            | ${-1}
      ${'1.0-pre.99'}           | ${'1.0-pre.2a'}            | ${-1}
      ${'1.0-pre.patch.3'}      | ${'1.0-pre.patch.4'}       | ${-1}
      ${'1.0--'}                | ${'1.0----'}               | ${-1}
    `('defaultCompare($a, $b)', ({ a, b, exp }) => {
      const abv = new BzlmodVersion(a);
      const bbv = new BzlmodVersion(b);
      expect(BzlmodVersion.defaultCompare(abv, bbv)).toBe(exp);
    });
  });
});
