import { extractPackageFile } from '.';
import { findExtents, findPrecedingIndentation, findDepends } from './extract';
import { Fixtures } from '../../../../test/fixtures';

describe('modules/manager/haskell-cabal', () => {
  describe('extractPackageFile()', () => {
    const autoReplaceStringTemplate = "{{{depName}}} {{#if isSingleVersion}}^>= {{newValue}}{{else}}{{{replace \" \" \" && \" newValue}}}{{/if}}";

    it('loads ending comma', () => {
      expect(extractPackageFile("build-depends: base,").deps[0].packageName).toBe("base");
    });

    it('loads two deps with no bounds', () => {
      expect(extractPackageFile("build-depends: base, issue").deps[1].packageName).toBe("issue");
    });

    it('loads leading comma', () => {
      extractPackageFile("build-depends:,other,other2");
    });

    it('loads cabal-tests cases without exception', () => {
      const
        regressions =
          [ "all-upper-bound",
            "anynone",
            "assoc-cpp-options",
            "cc-options-with-optimization",
            "common2",
            "common3",
            "common",
            "common-conditional",
            "cxx-options-with-optimization",
            "decreasing-indentation",
            "denormalised-paths",
            "elif2",
            "elif",
            "generics-sop",
            "haddock-api-2.18.1-check",
            "hidden-main-lib",
            "issue-5055",
            //"issue-5846",
            "issue-6083-a",
            "issue-6083-b",
            "issue-6083-c",
            "issue-6083-pkg-pkg",
            "issue-8646",
            "jaeger-flamegraph",
            "leading-comma-2",
            "leading-comma",
            "libpq1",
            "libpq2",
            "mixin-1",
            "mixin-2",
            "mixin-3",
            "monad-param",
            "multiple-libs-2",
            "noVersion",
            "Octree-0.5",
            "public-multilib-1",
            "public-multilib-2",
            "shake",
            "th-lift-instances",
            //"version-sets",
            "wl-pprint-indef",
            ];
      for (const basename of regressions) {
        const content = Fixtures.get(`../../../../../../cabal/Cabal-tests/tests/ParserTests/regressions/${basename}.cabal`);
        try {
          expect(extractPackageFile(content).deps.length).toBeGreaterThan(0);
        } catch (e) {
          expect(e).toBeInstanceOf(Error);
          throw new Error(`findDepends ${findDepends(content)}\nduring ${basename}: ${e.toString()}\n${e.stack}`);
        }
      }
    });

    const baseExpected =
      { currentValue: '>=4.16 <4.21'
      , depName: 'base'
      , packageName: 'base'
      , datasource: 'hackage'
      , replaceString: 'base >= 4.16 && < 4.21'
      , versioning: 'semver'
      , autoReplaceStringTemplate
      };
    const mtlExpected =
      { currentValue: '>=2.3 <2.4'
      , depName: 'mtl'
      , packageName: 'mtl'
      , datasource: 'hackage'
      , replaceString: 'mtl >= 2.3 && < 2.4'
      , versioning: 'semver'
      , autoReplaceStringTemplate
      };
    it('extracts upper bound', () => {
      const res = extractPackageFile("build-depends: base >= 4.16 && < 4.21");
      expect(res.deps).toEqual([baseExpected]);
    });

    it('^>=', () => {
      const res = extractPackageFile("build-depends: base ^>= 4.16");
      expect(res.deps).toEqual([
        { currentValue: '>=4.16 <4.17'
        , depName: 'base'
        , packageName: 'base'
        , datasource: 'hackage'
        , replaceString: 'base ^>= 4.16'
        , versioning: 'semver'
        , autoReplaceStringTemplate
        }]);
    });

    it('or with ^>=', () => {
      const res = extractPackageFile("build-depends: base ^>= 4.16 || ^>= 4.17");
      expect(res.deps).toEqual([
        { currentValue: '>=4.16 <4.17 || >=4.17 <4.18'
        , depName: 'base'
        , packageName: 'base'
        , datasource: 'hackage'
        , replaceString: 'base ^>= 4.16 || ^>= 4.17'
        , versioning: 'semver'
        , autoReplaceStringTemplate
        }]);
    });

    it('exact version', () => {
      const res = extractPackageFile("build-depends: aeson == 2.0.0.0");
      expect(res.deps).toEqual([
        { currentValue: '=2.0.0.0'
        , depName: 'aeson'
        , packageName: 'aeson'
        , datasource: 'hackage'
        , replaceString: 'aeson == 2.0.0.0'
        , versioning: 'semver'
        , autoReplaceStringTemplate
        }]);
    });

    it('2.*', () => {
      const res = extractPackageFile("build-depends: aeson == 2.*");
      expect(res.deps).toEqual([
        { currentValue: '2.*'
        , depName: 'aeson'
        , packageName: 'aeson'
        , datasource: 'hackage'
        , replaceString: 'aeson == 2.*'
        , versioning: 'semver'
        , autoReplaceStringTemplate
        }]);
    });

    it('two deps', () => {
      const res = extractPackageFile("build-depends: base >= 4.16 && < 4.21, mtl >= 2.3 && < 2.4");
      expect(res.deps).toEqual([baseExpected, mtlExpected]);
    });

    it('indentation', () => {
      const begin = "build-depends: base >= 4.16 && < 4.21\n  , mtl >= 2.3 && < 2.4\n";
      const end = "other-field: hi";
      const content = begin + end;
      expect(begin.length).toEqual(62);
      const expectedIndent = 0;
      expect(findPrecedingIndentation(content,0)).toEqual(expectedIndent);
      expect(findExtents(expectedIndent+1,content,"build-depends:".length)).toEqual(begin.length-1); // minus one because it should cut off the newline
      const res = extractPackageFile(content);
      expect(res.deps).toEqual([baseExpected, mtlExpected]);
    });

    it('no version bound', () => {
      // https://hackage.haskell.org/package/hnop-0.1/hnop.cabal
      const content = 'build-depends:       base';
      const res = extractPackageFile(content);
      expect(res.deps).toEqual([
        { currentValue: '*'
        , depName: 'base'
        , packageName: 'base'
        , datasource: 'hackage'
        , replaceString: 'base'
        , versioning: 'semver'
        , autoReplaceStringTemplate
        }]);
    });

    it('rejects parens', ()=> {
      const content = 'build-depends: base (^>=4.20.0.0 || <0) && <0';
      let caught;
      try {
        extractPackageFile(content);
      } catch(e) {
        caught = e;
      }
      expect(String(caught)).toBe("Error: can't handle parens yet");
    })
  });
});
