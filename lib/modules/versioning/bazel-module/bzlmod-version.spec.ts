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
  });

  describe('VersionPart', () => {
    it.each([
      { vp: VersionPart.create(), exp: '' },
      { vp: VersionPart.create('1', '2', '3'), exp: '1.2.3' },
    ])('.asString', ({ vp, exp }) => {
      expect(vp.asString).toBe(exp);
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
  });
});
