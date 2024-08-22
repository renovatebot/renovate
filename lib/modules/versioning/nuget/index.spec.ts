import nuget from '.';

describe('modules/versioning/nuget/index', () => {
  describe('isSingleVersion()', () => {
    it.each`
      input              | expected
      ${'[1.2.3]'}       | ${true}
      ${'1.2.3'}         | ${false}
      ${'[1.2.3,1.2.3]'} | ${false}
      ${'[1.2.3,1.2.4]'} | ${false}
      ${'foobar'}        | ${false}
    `('isSingleVersion("$input") === $expected', ({ input, expected }) => {
      expect(nuget.isSingleVersion(input)).toBe(expected);
    });
  });

  describe('isStable()', () => {
    it.each`
      input                          | expected
      ${'9.0.3'}                     | ${true}
      ${'1.2019.3.22'}               | ${true}
      ${'3.0.0-beta'}                | ${false}
      ${'2.0.2-pre20191018090318'}   | ${false}
      ${'1.0.0+c30d7625'}            | ${true}
      ${'2.3.4-beta+1990ef74'}       | ${false}
      ${'[1.2.3]'}                   | ${true}
      ${'[1.2.3-beta]'}              | ${false}
      ${'1.0.0+Metadata'}            | ${true}
      ${'1.0.0'}                     | ${true}
      ${'1.0.0-Beta'}                | ${false}
      ${'1.0.0-Beta+Meta'}           | ${false}
      ${'1.0.0-RC.X+Meta'}           | ${false}
      ${'1.0.0-RC.X.35.A.3455+Meta'} | ${false}
      ${'*'}                         | ${false}
      ${'1.0.*'}                     | ${false}
      ${'1.0.*-*'}                   | ${false}
    `('isStable("$input") === $expected', ({ input, expected }) => {
      expect(nuget.isStable(input)).toBe(expected);
    });
  });

  describe('isValid()', () => {
    it.each`
      input                                | expected
      ${'2'}                               | ${true}
      ${'2.0'}                             | ${true}
      ${'2.0.0'}                           | ${true}
      ${'2.0.0.0'}                         | ${true}
      ${'9.0.3'}                           | ${true}
      ${'1.2019.3.22'}                     | ${true}
      ${'3.0.0-beta'}                      | ${true}
      ${'2.0.2-pre20191018090318'}         | ${true}
      ${'1.0.0+c30d7625'}                  | ${true}
      ${'2.3.4-beta+1990ef74'}             | ${true}
      ${'17.04'}                           | ${true}
      ${'3.0.0.beta'}                      | ${false}
      ${'5.1.2-+'}                         | ${false}
      ${'1--'}                             | ${true}
      ${'1.0.0+*'}                         | ${false}
      ${'1.0.**'}                          | ${false}
      ${'1.*.0'}                           | ${false}
      ${'1.0.*-*bla'}                      | ${false}
      ${'1.0.*-*bla+*'}                    | ${false}
      ${'**'}                              | ${false}
      ${'1.0.0-preview.*+blabla'}          | ${false}
      ${'1.0.*--'}                         | ${false}
      ${'1.0.*-alpha*+'}                   | ${false}
      ${'1.0.*-'}                          | ${false}
      ${null}                              | ${false}
      ${''}                                | ${false}
      ${'1.0.0-preview.*'}                 | ${true}
      ${'1.0.*-bla*'}                      | ${true}
      ${'1.0.*-*'}                         | ${true}
      ${'1.0.*-preview.1.*'}               | ${true}
      ${'1.0.*-preview.1*'}                | ${true}
      ${'1.0.0--'}                         | ${true}
      ${'1.0.0-bla*'}                      | ${true}
      ${'1.0.*--*'}                        | ${true}
      ${'1.0.0--*'}                        | ${true}
      ${'1.0.0+*'}                         | ${false}
      ${'1.0.**'}                          | ${false}
      ${'1.*.0'}                           | ${false}
      ${'1.0.*-*bla'}                      | ${false}
      ${'1.0.*-*bla+*'}                    | ${false}
      ${'**'}                              | ${false}
      ${'1.0.0-preview.*+blabla'}          | ${false}
      ${'1.0.*--'}                         | ${false}
      ${'1.0.*-alpha*+'}                   | ${false}
      ${'1.0.*-'}                          | ${false}
      ${'1.0.0-preview.*'}                 | ${true}
      ${'1.0.*-bla*'}                      | ${true}
      ${'1.0.*-*'}                         | ${true}
      ${'1.0.*-preview.1.*'}               | ${true}
      ${'1.0.*-preview.1*'}                | ${true}
      ${'1.0.0--'}                         | ${true}
      ${'1.0.0-bla*'}                      | ${true}
      ${'1.0.*--*'}                        | ${true}
      ${'1.0.0--*'}                        | ${true}
      ${'1.0.0.*-*'}                       | ${true}
      ${'1.0.*-*'}                         | ${true}
      ${'1.*-*'}                           | ${true}
      ${'*-rc.*'}                          | ${true}
      ${'*-*'}                             | ${true}
      ${'1.0.0-Beta'}                      | ${true}
      ${'1.0.0-Beta.2'}                    | ${true}
      ${'1.0.0+MetaOnly'}                  | ${true}
      ${'1.0.0'}                           | ${true}
      ${'1.0.0-Beta+Meta'}                 | ${true}
      ${'1.0.0-RC.X+MetaAA'}               | ${true}
      ${'1.0.0-RC.X.35.A.3455+Meta-A-B-C'} | ${true}
    `('isValid("$input") === $expected', ({ input, expected }) => {
      expect(nuget.isValid(input)).toBe(expected);
      expect(nuget.isCompatible(input)).toBe(expected);
    });
  });

  describe('isVersion()', () => {
    it.each`
      input                                             | expected
      ${'9.0.3'}                                        | ${true}
      ${'1.2019.3.22'}                                  | ${true}
      ${'3.0.0-beta'}                                   | ${true}
      ${'2.0.2-pre20191018090318'}                      | ${true}
      ${'1.0.0+c30d7625'}                               | ${true}
      ${'2.3.4-beta+1990ef74'}                          | ${true}
      ${'17.04'}                                        | ${true}
      ${'3.0.0.beta'}                                   | ${false}
      ${'5.1.2-+'}                                      | ${false}
      ${null}                                           | ${false}
      ${undefined}                                      | ${false}
      ${'1.0.0'}                                        | ${true}
      ${'0.0.1'}                                        | ${true}
      ${'1.2.3'}                                        | ${true}
      ${'1 . 2 . 3'}                                    | ${true}
      ${'1.2.3-alpha'}                                  | ${true}
      ${'1.2.3-X.y.3+Meta-2'}                           | ${true}
      ${'1.2.3-X.yZ.3.234.243.3242342+METADATA'}        | ${true}
      ${'1.2.3-X.y3+0'}                                 | ${true}
      ${'1.2.3-X+0'}                                    | ${true}
      ${'1.2.3+0'}                                      | ${true}
      ${'1.2.3-0'}                                      | ${true}
      ${'         '}                                    | ${false}
      ${'1beta'}                                        | ${false}
      ${'1.2Av^c'}                                      | ${false}
      ${'1.2..'}                                        | ${false}
      ${'1.2.3.4.5'}                                    | ${false}
      ${'1.2.3.Beta'}                                   | ${false}
      ${'1.2.3.4This version is full of awesomeness!!'} | ${false}
      ${'So.is.this'}                                   | ${false}
      ${'1.34.2Alpha'}                                  | ${false}
      ${'1.34.2Release Candidate'}                      | ${false}
      ${'1.4.7-'}                                       | ${false}
      ${'1.4.7-*'}                                      | ${false}
      ${'1.4.7+*'}                                      | ${false}
      ${'1.4.7-AA.01^'}                                 | ${false}
      ${'1.4.7-AA.0A^'}                                 | ${false}
      ${'1.4.7-A^A'}                                    | ${false}
      ${'1.4.7+AA.01^'}                                 | ${false}
      ${'1.2147483648'}                                 | ${true}
      ${'1.1.2147483648'}                               | ${true}
      ${'1.1.1.2147483648'}                             | ${true}
      ${'1.1.1.1.2147483648'}                           | ${false}
      ${'10000000000000000000'}                         | ${true}
      ${'1.10000000000000000000'}                       | ${true}
      ${'1.1.10000000000000000000'}                     | ${true}
      ${'1.1.1.1.10000000000000000000'}                 | ${false}
      ${'2147483648.2.3.4'}                             | ${true}
      ${'1.2147483648.3.4'}                             | ${true}
      ${'1.2.2147483648.4'}                             | ${true}
      ${'1.2.3.2147483648'}                             | ${true}
      ${'1..2'}                                         | ${false}
      ${'....'}                                         | ${false}
      ${'..1'}                                          | ${false}
      ${'-1.1.1.1'}                                     | ${false}
      ${'1.-1.1.1'}                                     | ${false}
      ${'1.1.-1.1'}                                     | ${false}
      ${'1.1.1.-1'}                                     | ${false}
      ${'1.'}                                           | ${false}
      ${'1.1.'}                                         | ${false}
      ${'1.1.1.'}                                       | ${false}
      ${'1.1.1.1.'}                                     | ${false}
      ${'1.1.1.1.1.'}                                   | ${false}
      ${'1     1.1.1.1'}                                | ${false}
      ${'1.1     1.1.1'}                                | ${false}
      ${'1.1.1     1.1'}                                | ${false}
      ${'1.1.1.1     1'}                                | ${false}
      ${' .1.1.1'}                                      | ${false}
      ${'1. .1.1'}                                      | ${false}
      ${'1.1. .1'}                                      | ${false}
      ${'1.1.1. '}                                      | ${false}
      ${'1 .'}                                          | ${false}
      ${'1.1 .'}                                        | ${false}
      ${'1.1.1 .'}                                      | ${false}
      ${'1.1.1.1 .'}                                    | ${false}
      ${'..1.2'}                                        | ${false}
      ${'-1.2.3.4'}                                     | ${false}
      ${'1.-2.3.4'}                                     | ${false}
      ${'1.2.-3.4'}                                     | ${false}
      ${'1.2.3.-4'}                                     | ${false}
      ${'   1 9'}                                       | ${false}
      ${'   19.   1 9'}                                 | ${false}
      ${'   19.   19.   1 9'}                           | ${false}
      ${'   19.   19.   19.   1 9'}                     | ${false}
      ${'1 9   '}                                       | ${false}
      ${'19   .1 9   '}                                 | ${false}
      ${'19   .19   .1 9   '}                           | ${false}
      ${'19   .19   .19   .1 9   '}                     | ${false}
      ${'   1 9   '}                                    | ${false}
      ${'   19   .   1 9   '}                           | ${false}
      ${'   19   .   19   .   1 9   '}                  | ${false}
      ${'   19   .   19   .   19   .   1 9   '}         | ${false}
    `('isVersion("$input") === $expected', ({ input, expected }) => {
      expect(nuget.isVersion(input)).toBe(expected);
    });
  });

  describe('getMajor, getMinor, getPatch', () => {
    it.each`
      input                                    | major         | minor         | patch
      ${''}                                    | ${null}       | ${null}       | ${null}
      ${null}                                  | ${null}       | ${null}       | ${null}
      ${undefined}                             | ${null}       | ${null}       | ${null}
      ${'1'}                                   | ${1}          | ${null}       | ${null}
      ${'1.2'}                                 | ${1}          | ${2}          | ${null}
      ${'1.2.3'}                               | ${1}          | ${2}          | ${3}
      ${'1.2.3.4'}                             | ${1}          | ${2}          | ${3}
      ${'   19'}                               | ${19}         | ${null}       | ${null}
      ${'   19.   19'}                         | ${19}         | ${19}         | ${null}
      ${'   19.   19.   19'}                   | ${19}         | ${19}         | ${19}
      ${'   19.   19.   19.   19'}             | ${19}         | ${19}         | ${19}
      ${'19   '}                               | ${19}         | ${null}       | ${null}
      ${'19   .19   '}                         | ${19}         | ${19}         | ${null}
      ${'19   .19   .19   '}                   | ${19}         | ${19}         | ${19}
      ${'19   .19   .19   .19   '}             | ${19}         | ${19}         | ${19}
      ${'   19   '}                            | ${19}         | ${null}       | ${null}
      ${'   19   .   19   '}                   | ${19}         | ${19}         | ${null}
      ${'   19   .   19   .   19   '}          | ${19}         | ${19}         | ${19}
      ${'   19   .   19   .   19   .   19   '} | ${19}         | ${19}         | ${19}
      ${'01.1.1.1'}                            | ${1}          | ${1}          | ${1}
      ${'1.01.1.1'}                            | ${1}          | ${1}          | ${1}
      ${'1.1.01.1'}                            | ${1}          | ${1}          | ${1}
      ${'1.1.1.01'}                            | ${1}          | ${1}          | ${1}
      ${'2147483647.1.1.1'}                    | ${2147483647} | ${1}          | ${1}
      ${'1.2147483647.1.1'}                    | ${1}          | ${2147483647} | ${1}
      ${'1.1.2147483647.1'}                    | ${1}          | ${1}          | ${2147483647}
      ${'1.1.1.2147483647'}                    | ${1}          | ${1}          | ${1}
    `(
      '$input -> [$major, $minor, $patch]',
      ({ input, major, minor, patch }) => {
        expect(nuget.getMajor(input)).toBe(major);
        expect(nuget.getMinor(input)).toBe(minor);
        expect(nuget.getPatch(input)).toBe(patch);
      },
    );
  });

  describe('equals()', () => {
    it.each`
      a                             | b                             | expected
      ${'17.4'}                     | ${'17.04'}                    | ${true}
      ${'1.4'}                      | ${'1.4.0'}                    | ${true}
      ${'1.0.110'}                  | ${'1.0.110.0'}                | ${true}
      ${'1.0.0'}                    | ${'1.0.0+c30d7625'}           | ${true}
      ${'foo'}                      | ${'bar'}                      | ${false}
      ${'1.022'}                    | ${'1.22.0.0'}                 | ${true}
      ${'23.2.3'}                   | ${'23.2.3.0'}                 | ${true}
      ${'1.3.42.10133'}             | ${'1.3.42.10133'}             | ${true}
      ${'1.0'}                      | ${'1.0.0.0'}                  | ${true}
      ${'1.23.01'}                  | ${'1.23.1'}                   | ${true}
      ${'1.45.6'}                   | ${'1.45.6.0'}                 | ${true}
      ${'1.45.6-Alpha'}             | ${'1.45.6-Alpha'}             | ${true}
      ${'1.6.2-BeTa'}               | ${'1.6.02-beta'}              | ${true}
      ${'22.3.07     '}             | ${'22.3.07'}                  | ${true}
      ${'1.0'}                      | ${'1.0.0.0+beta'}             | ${true}
      ${'1.0.0.0+beta.2'}           | ${'1.0.0.0+beta.1'}           | ${true}
      ${'1.0.0'}                    | ${'1.0.0'}                    | ${true}
      ${'1.0.0-BETA'}               | ${'1.0.0-beta'}               | ${true}
      ${'1.0.0-BETA+AA'}            | ${'1.0.0-beta+aa'}            | ${true}
      ${'1.0.0-BETA.X.y.5.77.0+AA'} | ${'1.0.0-beta.x.y.5.77.0+aa'} | ${true}
      ${'1.0.0'}                    | ${'1.0.0+beta'}               | ${true}
      ${'1.0'}                      | ${'1.0.0.0'}                  | ${true}
      ${'1.0+test'}                 | ${'1.0.0.0'}                  | ${true}
      ${'1.0.0.1-1.2.A'}            | ${'1.0.0.1-1.2.a+A'}          | ${true}
      ${'1.0.01'}                   | ${'1.0.1.0'}                  | ${true}
      ${'0.0.0'}                    | ${'1.0.0'}                    | ${false}
      ${'1.1.0'}                    | ${'1.0.0'}                    | ${false}
      ${'1.0.1'}                    | ${'1.0.0'}                    | ${false}
      ${'1.0.0-BETA'}               | ${'1.0.0-beta2'}              | ${false}
      ${'1.0.0+AA'}                 | ${'1.0.0-beta+aa'}            | ${false}
      ${'1.0.0-BETA+AA'}            | ${'1.0.0-beta'}               | ${true}
      ${'1.0.0-BETA.X.y.5.77.0+AA'} | ${'1.0.0-beta.x.y.5.79.0+aa'} | ${false}
      ${'1.2.3.4-RC+99'}            | ${'1.2.3.4-RC+99'}            | ${true}
      ${'1.2.3'}                    | ${'1.2.3'}                    | ${true}
      ${'1.2.3-Pre.2'}              | ${'1.2.3-Pre.2'}              | ${true}
      ${'1.2.3+99'}                 | ${'1.2.3+99'}                 | ${true}
      ${'1.2-Pre'}                  | ${'1.2.0-Pre'}                | ${true}
    `('equals($a, $b) === $expected', ({ a, b, expected }) => {
      expect(nuget.equals(a, b)).toBe(expected);
    });
  });

  describe('isGreaterThan()', () => {
    it.each`
      a                               | b                             | expected
      ${'2.4.2'}                      | ${'2.4.1'}                    | ${true}
      ${'2.4-beta'}                   | ${'2.4-alpha'}                | ${true}
      ${'1.9'}                        | ${'2'}                        | ${false}
      ${'1.9'}                        | ${'1.9.1'}                    | ${false}
      ${'2.4.0'}                      | ${'2.4.0-beta'}               | ${true}
      ${'2.4.0-alpha'}                | ${'2.4.0'}                    | ${false}
      ${'1.2.0-beta.333'}             | ${'1.2.0-beta.66'}            | ${true}
      ${'1.2.0-beta2'}                | ${'1.2.0-beta10'}             | ${true}
      ${'1.2.0.1'}                    | ${'1.2.0'}                    | ${true}
      ${'1.2.0.1'}                    | ${'1.2.0.1-beta'}             | ${true}
      ${'1.2.0.1-beta'}               | ${'1.2.0.1'}                  | ${false}
      ${'1.2.0+1'}                    | ${'1.2.0'}                    | ${false}
      ${'1.2.0'}                      | ${'1.2.0+1'}                  | ${false}
      ${'1-a'}                        | ${'1-0'}                      | ${true}
      ${'1-a.b'}                      | ${'1-a'}                      | ${true}
      ${'1-a'}                        | ${'1-a.b'}                    | ${false}
      ${'foo'}                        | ${'bar'}                      | ${false}
      ${'bar'}                        | ${'foo'}                      | ${false}
      ${'1.0.1'}                      | ${'1.0'}                      | ${true}
      ${'1.231'}                      | ${'1.23'}                     | ${true}
      ${'1.45.6'}                     | ${'1.4.5.6'}                  | ${true}
      ${'1.4.5.60'}                   | ${'1.4.5.6'}                  | ${true}
      ${'1.10'}                       | ${'1.01'}                     | ${true}
      ${'1.10-beta'}                  | ${'1.01-alpha'}               | ${true}
      ${'1.10.0-rc-2'}                | ${'1.01.0-RC-1'}              | ${true}
      ${'1.01'}                       | ${'1.01-RC-1'}                | ${true}
      ${'1.2-preview'}                | ${'1.01'}                     | ${true}
      ${'1.0.0'}                      | ${'0.0.0'}                    | ${true}
      ${'1.1.0'}                      | ${'1.0.0'}                    | ${true}
      ${'1.0.1'}                      | ${'1.0.0'}                    | ${true}
      ${'2.1.1'}                      | ${'1.999.9999'}               | ${true}
      ${'1.0.0-beta2'}                | ${'1.0.0-BETA'}               | ${true}
      ${'1.0.0+aa'}                   | ${'1.0.0-beta+AA'}            | ${true}
      ${'1.0.0-beta.1+AA'}            | ${'1.0.0-BETA'}               | ${true}
      ${'1.0.0-beta.x.y.5.79.0+aa'}   | ${'1.0.0-BETA.X.y.5.77.0+AA'} | ${true}
      ${'1.0.0-beta.x.y.5.790.0+abc'} | ${'1.0.0-BETA.X.y.5.79.0+AA'} | ${true}
    `('isGreaterThan($a, $b) === $expected', ({ a, b, expected }) => {
      expect(nuget.isGreaterThan(a, b)).toBe(expected);
    });
  });

  describe('isLessThanRange()', () => {
    it.each`
      version         | range          | expected
      ${'foo'}        | ${'bar'}       | ${false}
      ${'1'}          | ${'bar'}       | ${false}
      ${'foo'}        | ${'1'}         | ${false}
      ${'1'}          | ${'1'}         | ${false}
      ${'1'}          | ${'2'}         | ${true}
      ${'2'}          | ${'1'}         | ${false}
      ${'1.2.3'}      | ${'[1.2.3]'}   | ${false}
      ${'1.2.3'}      | ${'[1.2.4]'}   | ${true}
      ${'1.2.3'}      | ${'[1.2.2]'}   | ${false}
      ${'1'}          | ${'(1,)'}      | ${true}
      ${'1'}          | ${'[1,)'}      | ${false}
      ${'1-beta'}     | ${'(1,)'}      | ${true}
      ${'1-beta'}     | ${'[1,)'}      | ${true}
      ${'1'}          | ${'(1,2]'}     | ${true}
      ${'1'}          | ${'[1,2]'}     | ${false}
      ${'1'}          | ${'(1.*,2]'}   | ${true}
      ${'1'}          | ${'[1.*,2]'}   | ${false}
      ${'1'}          | ${'(,1)'}      | ${false}
      ${'1'}          | ${'(,1]'}      | ${false}
      ${'1'}          | ${'(,2)'}      | ${false}
      ${'1'}          | ${'(,2]'}      | ${false}
      ${'1'}          | ${'*'}         | ${false}
      ${'0'}          | ${'1.*'}       | ${true}
      ${'2'}          | ${'1.*'}       | ${false}
      ${'1-beta'}     | ${'*'}         | ${false}
      ${'1-beta'}     | ${'1.*'}       | ${true}
      ${'1'}          | ${'1.*'}       | ${false}
      ${'1-beta'}     | ${'1.*-*'}     | ${false}
      ${'1.2-beta'}   | ${'1.2.*'}     | ${true}
      ${'1.2'}        | ${'1.2.*'}     | ${false}
      ${'1.2-beta'}   | ${'1.2.*-*'}   | ${false}
      ${'1.2.3-beta'} | ${'1.2.3.*'}   | ${true}
      ${'1.2.3'}      | ${'1.2.3.*'}   | ${false}
      ${'1.2.3-beta'} | ${'1.2.3.*-*'} | ${false}
    `(
      'isLessThanRange("$version", "$range") === $expected',
      ({ version, range, expected }) => {
        expect(nuget.isLessThanRange?.(version, range)).toBe(expected);
      },
    );
  });

  describe('getSatisfyingVersion()', () => {
    it.each`
      versions                                                                    | range               | expected
      ${[]}                                                                       | ${'[1,2)'}          | ${null}
      ${['foobar']}                                                               | ${'[1,2)'}          | ${null}
      ${['1', '2', '3']}                                                          | ${'foobar'}         | ${null}
      ${['0.1', '1', '1.1', '2-beta', '2']}                                       | ${'[1,2)'}          | ${'1.1'}
      ${['0.1.0', '1.0.0-alpha.2', '2.0.0', '2.2.0', '3.0.0']}                    | ${'[1.0.*, 2.0.0)'} | ${null}
      ${['0.1.0', '0.2.0', '1.0.0-alpha.2']}                                      | ${'[1.0.*, 2.0.0)'} | ${null}
      ${['2.0.0', '2.0.0-alpha.2', '3.1.0']}                                      | ${'[1.0.*, 2.0.0)'} | ${null}
      ${['0.1.0', '0.2.0', '1.0.0-alpha.2']}                                      | ${'[1.0.*, )'}      | ${null}
      ${['0.1.0', '0.2.0', '1.0.0-alpha.2', '101.0.0']}                           | ${'[1.0.*, )'}      | ${'101.0.0'}
      ${['1.0.0', '1.0.1', '2.0.0']}                                              | ${'1.0.0'}          | ${'2.0.0'}
      ${['0.1.0', '1.0.0', '1.2.0', '2.0.0']}                                     | ${'1.*'}            | ${'2.0.0'}
      ${['0.1.0', '2.0.0', '2.5.0', '3.3.0']}                                     | ${'*'}              | ${'3.3.0'}
      ${['0.1.0-alpha', '1.0.0-alpha01', '1.0.0-alpha02', '2.0.0-beta', '2.0.1']} | ${'1.0.0-alpha*'}   | ${'2.0.1'}
      ${['1.0.0', '2.0.0']}                                                       | ${'[2.0.0, )'}      | ${'2.0.0'}
      ${['1.0.0']}                                                                | ${'[2.0.0, )'}      | ${null}
      ${['1.0.1-beta.1', '1.0.1']}                                                | ${'1.0.0-*'}        | ${'1.0.1'}
      ${['foobar', '0.9.0', '1.0.1-beta.1', '1.0.1']}                             | ${'1.0.0'}          | ${'1.0.1'}
    `(
      'getSatisfyingVersion($versions, $range) === "$expected"',
      ({ versions, range, expected }) => {
        expect(nuget.getSatisfyingVersion(versions, range)).toBe(expected);
      },
    );
  });

  describe('minSatisfyingVersion()', () => {
    it.each`
      versions                                        | range       | expected
      ${[]}                                           | ${'[1,2)'}  | ${null}
      ${['foobar']}                                   | ${'[1,2)'}  | ${null}
      ${['1', '2', '3']}                              | ${'foobar'} | ${null}
      ${['0.1', '1-beta', '1', '1.1', '2-beta', '2']} | ${'[1,2)'}  | ${'1'}
      ${['foobar', '0.9.0', '1.0.0', '1.0.1']}        | ${'1.0.0'}  | ${'1.0.0'}
    `(
      'minSatisfyingVersion($versions, $range) === $expected',
      ({ versions, range, expected }) => {
        expect(nuget.minSatisfyingVersion(versions, range)).toBe(expected);
      },
    );
  });

  describe('getNewValue()', () => {
    it('returns newVersion if the range is version too', () => {
      expect(
        nuget.getNewValue({
          rangeStrategy: 'replace',
          currentValue: '1.0.0',
          newVersion: '1.2.3',
        }),
      ).toBe('1.2.3');
    });

    it('returns null if version is invalid', () => {
      expect(
        nuget.getNewValue({
          rangeStrategy: 'replace',
          currentValue: '[1.2.3]',
          newVersion: 'foobar',
        }),
      ).toBeNull();
    });

    it('returns null if range is invalid', () => {
      expect(
        nuget.getNewValue({
          rangeStrategy: 'replace',
          currentValue: 'foobar',
          newVersion: '1.2.3',
        }),
      ).toBeNull();
    });

    describe('pin', () => {
      it('returns the new version', () => {
        expect(
          nuget.getNewValue({
            rangeStrategy: 'pin',
            currentValue: '1.0.0',
            newVersion: '2.0.0',
          }),
        ).toBe('[2.0.0]');
      });
    });

    describe('bump', () => {
      it.each`
        currentValue       | newVersion       | expected
        ${'[1.0.0.0]'}     | ${'2.0.0.0'}     | ${'[2.0.0.0]'}
        ${'[1]'}           | ${'2-beta+meta'} | ${'[2-beta+meta]'}
        ${'*'}             | ${'1.2.3'}       | ${'*'}
        ${'*-*'}           | ${'1.2.3'}       | ${'*-*'}
        ${'1.*'}           | ${'1.2.3'}       | ${'1.*'}
        ${'1.*'}           | ${'2'}           | ${'2.*'}
        ${'1.*-*'}         | ${'2'}           | ${'2.*-*'}
        ${'1.2.*'}         | ${'2'}           | ${'2.0.*'}
        ${'1.2.*-*'}       | ${'2'}           | ${'2.0.*-*'}
        ${'1.2.3.*'}       | ${'2'}           | ${'2.0.0.*'}
        ${'1.2.3.*-*'}     | ${'2'}           | ${'2.0.0.*-*'}
        ${'1.*'}           | ${'2-beta'}      | ${'1.*'}
        ${'1.*-*'}         | ${'2-beta'}      | ${'2.*-*'}
        ${'1-*'}           | ${'2-beta'}      | ${'2-beta'}
        ${'(1.0.0,)'}      | ${'0.0.1'}       | ${'(1.0.0,)'}
        ${'(1.0.0,)'}      | ${'1.2.3'}       | ${'[1.2.3,)'}
        ${'[1.0.0,)'}      | ${'1.2.3'}       | ${'[1.2.3,)'}
        ${'(,1.0.0)'}      | ${'0.0.1'}       | ${'(,1.0.0)'}
        ${'(,1.0.0)'}      | ${'1.2.3'}       | ${'(,1.2.3]'}
        ${'(,1.0.0]'}      | ${'1.2.3'}       | ${'(,1.2.3]'}
        ${'(1.0.0,1.2.3)'} | ${'0.0.1'}       | ${'(1.0.0,1.2.3)'}
        ${'(1.0.0,1.2.3)'} | ${'2.0.0'}       | ${'(1.0.0,2.0.0]'}
        ${'(1.0.0,1.2.3]'} | ${'2.0.0'}       | ${'(1.0.0,2.0.0]'}
        ${'(1.0.0,1.2.3)'} | ${'1.0.1'}       | ${'(1.0.0,1.2.3)'}
        ${'(1.0.0,1.2.3)'} | ${'1.0.1'}       | ${'(1.0.0,1.2.3)'}
        ${'(1.0.0,1.2.3]'} | ${'1.0.1'}       | ${'(1.0.0,1.2.3]'}
      `(
        'currentValue=$currentValue newVersion=$newVersion -> $expected',
        ({ currentValue, newVersion, expected }) => {
          expect(
            nuget.getNewValue({
              rangeStrategy: 'bump',
              currentValue,
              newVersion,
            }),
          ).toBe(expected);
        },
      );
    });
  });

  describe('sortVersions', () => {
    it.each`
      a            | b            | expected
      ${'1'}       | ${'1'}       | ${0}
      ${'1'}       | ${'2'}       | ${-1}
      ${'2'}       | ${'1'}       | ${1}
      ${'0.1'}     | ${'0.1'}     | ${0}
      ${'0.1'}     | ${'0.2'}     | ${-1}
      ${'0.2'}     | ${'0.1'}     | ${1}
      ${'0.0.1'}   | ${'0.0.1'}   | ${0}
      ${'0.0.1'}   | ${'0.0.2'}   | ${-1}
      ${'0.0.2'}   | ${'0.0.1'}   | ${1}
      ${'0.0.0.1'} | ${'0.0.0.1'} | ${0}
      ${'0.0.0.1'} | ${'0.0.0.2'} | ${-1}
      ${'0.0.0.2'} | ${'0.0.0.1'} | ${1}
      ${'1-abc'}   | ${'1-ABC'}   | ${0}
      ${'1-ABC'}   | ${'1-abc'}   | ${0}
      ${'1-abc'}   | ${'1-xyz'}   | ${-1}
      ${'1-xyz'}   | ${'1-abc'}   | ${1}
      ${'foo'}     | ${'bar'}     | ${0}
    `('sortVersions($a, $b) === $expected', ({ a, b, expected }) => {
      expect(nuget.sortVersions(a, b)).toBe(expected);
    });
  });

  describe('matches()', () => {
    it.each`
      version           | range              | expected
      ${'foo'}          | ${'1'}             | ${false}
      ${'1'}            | ${'foo'}           | ${false}
      ${'1'}            | ${'1'}             | ${true}
      ${'1'}            | ${'2'}             | ${false}
      ${'2'}            | ${'1'}             | ${true}
      ${'1.2.3'}        | ${'[1.2.3]'}       | ${true}
      ${'1.2.3'}        | ${'[1.2.4]'}       | ${false}
      ${'1.2.3'}        | ${'[1.2.2]'}       | ${false}
      ${'1'}            | ${'*'}             | ${true}
      ${'0.1'}          | ${'1.*'}           | ${false}
      ${'2'}            | ${'1.*'}           | ${true}
      ${'1-beta'}       | ${'*'}             | ${false}
      ${'1-beta'}       | ${'*-*'}           | ${true}
      ${'1'}            | ${'1.*'}           | ${true}
      ${'1-beta'}       | ${'1.*'}           | ${false}
      ${'1'}            | ${'1.*-*'}         | ${true}
      ${'1-beta'}       | ${'1.*-*'}         | ${true}
      ${'1.2'}          | ${'1.2.*'}         | ${true}
      ${'1.2-beta'}     | ${'1.2.*'}         | ${false}
      ${'1.2'}          | ${'1.2.*-*'}       | ${true}
      ${'1.2-beta'}     | ${'1.2.*-*'}       | ${true}
      ${'1.2.3'}        | ${'1.2.3.*'}       | ${true}
      ${'1.2.3-beta'}   | ${'1.2.3.*'}       | ${false}
      ${'1.2.3'}        | ${'1.2.3.*-*'}     | ${true}
      ${'1.2.3-beta'}   | ${'1.2.3.*-*'}     | ${true}
      ${'1.2.3.4'}      | ${'1.2.3.*'}       | ${true}
      ${'1.2.3.4-beta'} | ${'1.2.3.*'}       | ${false}
      ${'1.2.3.4'}      | ${'1.2.3.*-*'}     | ${true}
      ${'1.2.3.4-beta'} | ${'1.2.3.*-*'}     | ${true}
      ${'1.0.0-alpha'}  | ${'1.0.0-*'}       | ${true}
      ${'1.0.0-beta'}   | ${'1.0.0-*'}       | ${true}
      ${'1.0.0'}        | ${'1.0.0-*'}       | ${true}
      ${'1.0.1-alpha'}  | ${'1.0.0-*'}       | ${true}
      ${'1.0.1'}        | ${'1.0.0-*'}       | ${true}
      ${'1'}            | ${'(1,)'}          | ${false}
      ${'1'}            | ${'[1,)'}          | ${true}
      ${'1'}            | ${'(1,2]'}         | ${false}
      ${'1'}            | ${'[1,2]'}         | ${true}
      ${'1'}            | ${'(1,2)'}         | ${false}
      ${'1'}            | ${'[1,2)'}         | ${true}
      ${'2'}            | ${'(1,2]'}         | ${true}
      ${'2'}            | ${'[1,2]'}         | ${true}
      ${'2'}            | ${'(1,2)'}         | ${false}
      ${'2'}            | ${'[1,2)'}         | ${false}
      ${'1'}            | ${'(,1)'}          | ${false}
      ${'1'}            | ${'(,1]'}          | ${true}
      ${'1'}            | ${'(,2)'}          | ${true}
      ${'1'}            | ${'(,2]'}          | ${true}
      ${'1'}            | ${'[1.*,]'}        | ${true}
      ${'1-beta'}       | ${'[1.*,]'}        | ${false}
      ${'1'}            | ${'(1.*,]'}        | ${false}
      ${'1'}            | ${'(1.*-beta*,]'}  | ${true}
      ${'1-beta'}       | ${'(1.*-beta*,]'}  | ${false}
      ${'1'}            | ${'[1.*-beta*,]'}  | ${true}
      ${'1-beta'}       | ${'[1.*-beta*,]'}  | ${true}
      ${'2.0.0-alpha'}  | ${'(1.0.0,2.0.0]'} | ${false}
    `(
      'matches("$version", "$range") === $expected',
      ({ version, range, expected }) => {
        expect(nuget.matches(version, range)).toBe(expected);
      },
    );
  });
});
