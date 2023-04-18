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
    ])('$a is lessThan $b', ({ a, b, exp }) => {
      const avp = VersionPart.create(...a);
      const bvp = VersionPart.create(...b);
      expect(avp.lessThan(bvp)).toBe(exp);
    });
  });

  describe('BzlmodVersion', () => {
    it.each([
      { v: '1.2.3', rexp: '1.2.3', pexp: '', bexp: '' },
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
      { a: '1.2.3', b: '1.2.3', exp: true },
      { a: '1.2.3', b: '1.2.4', exp: false },
      { a: '1.2.3', b: '1.2.3-pre.20230417.1', exp: false },
      { a: '1.2.3', b: '1.2.3+build5', exp: false },
      { a: '1.2.3', b: '1.2.3-pre.20230417.1+build5', exp: false },
      { a: '1.2.3', b: 'foo1.2.3', exp: false },
    ])('$a equals $b', ({ a, b, exp }) => {
      const abv = new BzlmodVersion(a);
      const bbv = new BzlmodVersion(b);
      expect(abv.equals(bbv)).toBe(exp);
    });
  });
});
