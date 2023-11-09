import { api as conan } from '.';

describe('modules/versioning/conan/index', () => {
  // isValid(version: string): boolean;
  it.each`
    version                                                      | result
    ${'[1.2.3.4, loose=False]'}                                  | ${false}
    ${'[NOT VALID, loose=False]'}                                | ${false}
    ${'[1.2, loose=False]'}                                      | ${true}
    ${'[1.a.2, loose=False]'}                                    | ${false}
    ${'[Infinity.NaN.Infinity, loose=False]'}                    | ${false}
    ${'1.2.3.4'}                                                 | ${true}
    ${'NOT VALID'}                                               | ${false}
    ${'1.2'}                                                     | ${true}
    ${'1.a.2'}                                                   | ${false}
    ${''}                                                        | ${true}
    ${'Infinity.NaN.Infinity'}                                   | ${false}
    ${'17.04.0'}                                                 | ${true}
    ${'1.2.3'}                                                   | ${true}
    ${'1.2.3-foo'}                                               | ${true}
    ${'[>1.1 <2.0]'}                                             | ${true}
    ${'1.2.3foo'}                                                | ${true}
    ${'[~1.2.3]'}                                                | ${true}
    ${'[^1.2.3]'}                                                | ${true}
    ${'1.x'}                                                     | ${true}
    ${'[>1.2.3]'}                                                | ${true}
    ${'[>1.1 <2.1]'}                                             | ${true}
    ${'[~=3.0]'}                                                 | ${true}
    ${'[>1.1 || 0.8]'}                                           | ${true}
    ${'[1.2.7 || >=1.2.9 <2.0.0]'}                               | ${true}
    ${'[>1.1 <2.1, include_prerelease=True]'}                    | ${true}
    ${'[~1.2.3, loose=False]'}                                   | ${true}
    ${'[~1.2.3, loose=False, include_prerelease=True]'}          | ${true}
    ${'renovatebot/renovate'}                                    | ${false}
    ${'renovatebot/renovate#main'}                               | ${false}
    ${'https://github.com/renovatebot/renovate.git'}             | ${false}
    ${'[>=01.02.03]'}                                            | ${true}
    ${'[~1.02.03beta]'}                                          | ${true}
    ${'[">1.0.0 <1.0.2", loose=False, include_prerelease=True]'} | ${true}
    ${'[1.0.0 - 2.0.0, loose=False]'}                            | ${true}
    ${'[1.0.0, loose=False]'}                                    | ${true}
    ${'[>=*, loose=False]'}                                      | ${true}
    ${'[, loose=False]'}                                         | ${true}
    ${'[*, loose=False]'}                                        | ${true}
    ${'[>=1.0.0, loose=False]'}                                  | ${true}
    ${'[>1.0.0, loose=False]'}                                   | ${true}
    ${'[<=2.0.0, loose=False]'}                                  | ${true}
    ${'[1, loose=False]'}                                        | ${true}
    ${'[<=2.0.0, loose=False]'}                                  | ${true}
    ${'[<=2.0.0, loose=False]'}                                  | ${true}
    ${'[<2.0.0, loose=False]'}                                   | ${true}
    ${'[<2.0.0, loose=False]'}                                   | ${true}
    ${'[>= 1.0.0, loose=False]'}                                 | ${true}
    ${'[>=  1.0.0, loose=False]'}                                | ${true}
    ${'[>=   1.0.0, loose=False]'}                               | ${true}
    ${'[> 1.0.0, loose=False]'}                                  | ${true}
    ${'[>  1.0.0, loose=False]'}                                 | ${true}
    ${'[<=   2.0.0, loose=False]'}                               | ${true}
    ${'[<= 2.0.0, loose=False]'}                                 | ${true}
    ${'[<=  2.0.0, loose=False]'}                                | ${true}
    ${'[<    2.0.0, loose=False]'}                               | ${true}
    ${'[<	2.0.0, loose=False]'}                                   | ${true}
    ${'[>=0.1.97, loose=False]'}                                 | ${true}
    ${'[>=0.1.97, loose=False]'}                                 | ${true}
    ${'[0.1.20 || 1.2.4, loose=False]'}                          | ${true}
    ${'[>=0.2.3 || <0.0.1, loose=False]'}                        | ${true}
    ${'[>=0.2.3 || <0.0.1, loose=False]'}                        | ${true}
    ${'[>=0.2.3 || <0.0.1, loose=False]'}                        | ${true}
    ${'[||, loose=False]'}                                       | ${true}
    ${'[2.x.x, loose=False]'}                                    | ${true}
    ${'[1.2.x, loose=False]'}                                    | ${true}
    ${'[1.2.x || 2.x, loose=False]'}                             | ${true}
    ${'[1.2.x || 2.x, loose=False]'}                             | ${true}
    ${'[x, loose=False]'}                                        | ${true}
    ${'[2.*.*, loose=False]'}                                    | ${true}
    ${'[1.2.*, loose=False]'}                                    | ${true}
    ${'[1.2.* || 2.*, loose=False]'}                             | ${true}
    ${'[*, loose=False]'}                                        | ${true}
    ${'[2, loose=False]'}                                        | ${true}
    ${'[2.3, loose=False]'}                                      | ${true}
    ${'[~2.4, loose=False]'}                                     | ${true}
    ${'[~>3.2.1, loose=False]'}                                  | ${true}
    ${'[~1, loose=False]'}                                       | ${true}
    ${'[~>1, loose=False]'}                                      | ${true}
    ${'[~> 1, loose=False]'}                                     | ${true}
    ${'[~1.0, loose=False]'}                                     | ${true}
    ${'[~ 1.0, loose=False]'}                                    | ${true}
    ${'[^0, loose=False]'}                                       | ${true}
    ${'[^ 1, loose=False]'}                                      | ${true}
    ${'[^0.1, loose=False]'}                                     | ${true}
    ${'[^1.0, loose=False]'}                                     | ${true}
    ${'[^1.2, loose=False]'}                                     | ${true}
    ${'[^0.0.1, loose=False]'}                                   | ${true}
    ${'[^0.0.1-beta, loose=False]'}                              | ${true}
    ${'[^0.1.2, loose=False]'}                                   | ${true}
    ${'[^1.2.3, loose=False]'}                                   | ${true}
    ${'[^1.2.3-beta.4, loose=False]'}                            | ${true}
    ${'[<1, loose=False]'}                                       | ${true}
    ${'[< 1, loose=False]'}                                      | ${true}
    ${'[>=1, loose=False]'}                                      | ${true}
    ${'[>= 1, loose=False]'}                                     | ${true}
    ${'[<1.2, loose=False]'}                                     | ${true}
    ${'[< 1.2, loose=False]'}                                    | ${true}
    ${'[1, loose=False]'}                                        | ${true}
    ${'[>01.02.03, loose=True]'}                                 | ${true}
    ${'[>01.02.03, loose=False]'}                                | ${false}
    ${'[~1.2.3beta, loose=True]'}                                | ${true}
    ${'[~1.2.3beta, loose=False]'}                               | ${false}
    ${'[^ 1.2 ^ 1, loose=False]'}                                | ${true}
  `('isValid("$version") === $result', ({ version, result }) => {
    const res = conan.isValid(version);
    expect(res).toBe(result);
  });

  // isVersion(version: string): boolean;
  // isSingleVersion(version: string): boolean;
  it.each`
    version                                            | result
    ${'1.0.7-prerelease.1'}                            | ${true}
    ${'1.0.7-prerelease.1, include_prerelease=True'}   | ${true}
    ${'NOT VALID, loose=False'}                        | ${false}
    ${'NOT VALID'}                                     | ${false}
    ${'1.a.2, loose=False'}                            | ${false}
    ${'1.a.2'}                                         | ${true}
    ${null}                                            | ${false}
    ${'1.2, loose=False'}                              | ${false}
    ${'1.2'}                                           | ${true}
    ${'1.2.3.4, loose=False'}                          | ${false}
    ${'1.2.3.4'}                                       | ${true}
    ${'1.2.23.4'}                                      | ${true}
    ${'4.1.3-pre, include_prerelease=True'}            | ${true}
    ${'X.2, loose=False'}                              | ${false}
    ${'X.2'}                                           | ${true}
    ${'Infinity.NaN.Infinity, loose=False'}            | ${false}
    ${'Infinity.NaN.Infinity'}                         | ${false}
    ${'1.2.3'}                                         | ${true}
    ${'"1.2.3", loose=False'}                          | ${true}
    ${'"1.2.3", loose=False, include_prerelease=True'} | ${true}
    ${'"1.2.3", include_prerelease=True'}              | ${true}
    ${'1.2.3-alpha.1'}                                 | ${true}
    ${'"1.2.3-alpha.1", include_prerelease=True'}      | ${true}
    ${'"1.2.6-pre.1", include_prerelease=True'}        | ${true}
    ${'"1.2.3-dev.1+abc", include_prerelease=True'}    | ${true}
    ${'1.2.3-dev.1+abc'}                               | ${true}
    ${'1.2.6-pre.1'}                                   | ${true}
    ${'=1.2.3'}                                        | ${true}
    ${'= 1.2.3'}                                       | ${true}
    ${'1.x'}                                           | ${true}
    ${'"1.x", loose=False'}                            | ${false}
    ${'01.02.03'}                                      | ${true}
    ${'1.2.3-beta.01, include_prerelease=True'}        | ${true}
    ${'   =1.2.3'}                                     | ${true}
    ${'1.2.3foo, include_prerelease=True'}             | ${true}
    ${'5.0.20210712-T1759Z+b563c1478'}                 | ${true}
    ${'0.2'}                                           | ${true}
    ${'16.00'}                                         | ${true}
  `('isVersion("$version") === $result', ({ version, result }) => {
    const res = conan.isVersion(version);
    expect(res).toBe(result);
  });

  // isCompatible(version: string, range?: string): boolean;
  it.each`
    range                                                                           | version              | result
    ${'[>1.1 <2.0]'}                                                                | ${'1.2.3'}           | ${true}
    ${'["~1.2.3", loose=False, include_prerelease=True]'}                           | ${'1.2.3-pre.1'}     | ${false}
    ${'["1.0.0 - 2.0.0", loose=False, include_prerelease=False]'}                   | ${'1.2.3'}           | ${true}
    ${'["^1.2.3+build", loose=False, include_prerelease=False]'}                    | ${'1.2.3'}           | ${true}
    ${'["^1.2.3+build", loose=False, include_prerelease=False]'}                    | ${'1.3.0'}           | ${true}
    ${'["1.2.3-pre+asdf - 2.4.3-pre+asdf", loose=False, include_prerelease=False]'} | ${'1.2.3'}           | ${true}
    ${'["1.2.3pre+asdf - 2.4.3-pre+asdf", loose=True, include_prerelease=False]'}   | ${'1.2.3'}           | ${true}
    ${'["1.2.3-pre+asdf - 2.4.3pre+asdf", loose=True, include_prerelease=False]'}   | ${'1.2.3'}           | ${true}
    ${'["1.2.3pre+asdf - 2.4.3pre+asdf", loose=True, include_prerelease=False]'}    | ${'1.2.3'}           | ${true}
    ${'["1.2.3-pre+asdf - 2.4.3-pre+asdf", loose=False, include_prerelease=False]'} | ${'1.2.3-pre.2'}     | ${false}
    ${'["1.2.3-pre+asdf - 2.4.3-pre+asdf", loose=False, include_prerelease=False]'} | ${'2.4.3-alpha'}     | ${false}
    ${'["1.2.3+asdf - 2.4.3+asdf", loose=False, include_prerelease=False]'}         | ${'1.2.3'}           | ${true}
    ${'["1.0.0", loose=False, include_prerelease=False]'}                           | ${'1.0.0'}           | ${true}
    ${'[">=*", loose=False, include_prerelease=False]'}                             | ${'0.2.4'}           | ${true}
    ${'["", loose=False, include_prerelease=False]'}                                | ${'1.0.0'}           | ${true}
    ${'["*", loose=False, include_prerelease=False]'}                               | ${'1.2.3'}           | ${true}
    ${'["*", loose=True, include_prerelease=False]'}                                | ${'v1.2.3'}          | ${true}
    ${'[">=1.0.0", loose=False, include_prerelease=False]'}                         | ${'1.0.0'}           | ${true}
    ${'[">=1.0.0", loose=False, include_prerelease=False]'}                         | ${'1.0.1'}           | ${true}
    ${'[">=1.0.0", loose=False, include_prerelease=False]'}                         | ${'1.1.0'}           | ${true}
    ${'[">1.0.0", loose=False, include_prerelease=False]'}                          | ${'1.0.1'}           | ${true}
    ${'[">1.0.0", loose=False, include_prerelease=True]'}                           | ${'1.0.1-pre.1'}     | ${true}
    ${'[">1.0.0", loose=False, include_prerelease=False]'}                          | ${'1.1.0'}           | ${true}
    ${'["<=2.0.0", loose=False, include_prerelease=False]'}                         | ${'2.0.0'}           | ${true}
    ${'["<=2.0.0", loose=False, include_prerelease=False]'}                         | ${'1.9999.9999'}     | ${true}
    ${'["<=2.0.0", loose=False, include_prerelease=False]'}                         | ${'0.2.9'}           | ${true}
    ${'["<2.0.0", loose=False, include_prerelease=False]'}                          | ${'1.9999.9999'}     | ${true}
    ${'["<2.0.0", loose=False, include_prerelease=False]'}                          | ${'0.2.9'}           | ${true}
    ${'[">= 1.0.0", loose=False, include_prerelease=False]'}                        | ${'1.0.0'}           | ${true}
    ${'[">=  1.0.0", loose=False, include_prerelease=False]'}                       | ${'1.0.1'}           | ${true}
    ${'[">=   1.0.0", loose=False, include_prerelease=False]'}                      | ${'1.1.0'}           | ${true}
    ${'["> 1.0.0", loose=False, include_prerelease=False]'}                         | ${'1.0.1'}           | ${true}
    ${'[">  1.0.0", loose=False, include_prerelease=False]'}                        | ${'1.1.0'}           | ${true}
    ${'["<=   2.0.0", loose=False, include_prerelease=False]'}                      | ${'2.0.0'}           | ${true}
    ${'["<= 2.0.0", loose=False, include_prerelease=False]'}                        | ${'1.9999.9999'}     | ${true}
    ${'["<=  2.0.0", loose=False, include_prerelease=False]'}                       | ${'0.2.9'}           | ${true}
    ${'["<    2.0.0", loose=False, include_prerelease=False]'}                      | ${'1.9999.9999'}     | ${true}
    ${'["<\t2.0.0", loose=False, include_prerelease=False]'}                        | ${'0.2.9'}           | ${true}
    ${'[">=0.1.97", loose=True, include_prerelease=False]'}                         | ${'v0.1.97'}         | ${true}
    ${'[">=0.1.97", loose=False, include_prerelease=False]'}                        | ${'0.1.97'}          | ${true}
    ${'["0.1.20 || 1.2.4", loose=False, include_prerelease=False]'}                 | ${'1.2.4'}           | ${true}
    ${'[">=0.2.3 || <0.0.1", loose=False, include_prerelease=False]'}               | ${'0.0.0'}           | ${true}
    ${'[">=0.2.3 || <0.0.1", loose=False, include_prerelease=False]'}               | ${'0.2.3'}           | ${true}
    ${'[">=0.2.3 || <0.0.1", loose=False, include_prerelease=False]'}               | ${'0.2.4'}           | ${true}
    ${'["||", loose=False, include_prerelease=False]'}                              | ${'1.3.4'}           | ${true}
    ${'["2.x.x", loose=False, include_prerelease=False]'}                           | ${'2.1.3'}           | ${true}
    ${'["1.2.x", loose=False, include_prerelease=False]'}                           | ${'1.2.3'}           | ${true}
    ${'["1.2.x || 2.x", loose=False, include_prerelease=False]'}                    | ${'2.1.3'}           | ${true}
    ${'["1.2.x || 2.x", loose=False, include_prerelease=False]'}                    | ${'1.2.3'}           | ${true}
    ${'["x", loose=False, include_prerelease=False]'}                               | ${'1.2.3'}           | ${true}
    ${'["2.*.*", loose=False, include_prerelease=False]'}                           | ${'2.1.3'}           | ${true}
    ${'["1.2.*", loose=False, include_prerelease=False]'}                           | ${'1.2.3'}           | ${true}
    ${'["1.2.* || 2.*", loose=False, include_prerelease=False]'}                    | ${'2.1.3'}           | ${true}
    ${'["1.2.* || 2.*", loose=False, include_prerelease=False]'}                    | ${'1.2.3'}           | ${true}
    ${'["*", loose=False, include_prerelease=False]'}                               | ${'1.2.3'}           | ${true}
    ${'["2", loose=False, include_prerelease=False]'}                               | ${'2.1.2'}           | ${true}
    ${'["2.3", loose=False, include_prerelease=False]'}                             | ${'2.3.1'}           | ${true}
    ${'["~x", loose=False, include_prerelease=False]'}                              | ${'0.0.9'}           | ${true}
    ${'["~2", loose=False, include_prerelease=False]'}                              | ${'2.0.9'}           | ${true}
    ${'["~2.4", loose=False, include_prerelease=False]'}                            | ${'2.4.0'}           | ${true}
    ${'["~2.4", loose=False, include_prerelease=False]'}                            | ${'2.4.5'}           | ${true}
    ${'["~>3.2.1", loose=False, include_prerelease=False]'}                         | ${'3.2.2'}           | ${true}
    ${'["~1", loose=False, include_prerelease=False]'}                              | ${'1.2.3'}           | ${true}
    ${'["~>1", loose=False, include_prerelease=False]'}                             | ${'1.2.3'}           | ${true}
    ${'["~> 1", loose=False, include_prerelease=False]'}                            | ${'1.2.3'}           | ${true}
    ${'["~1.0", loose=False, include_prerelease=False]'}                            | ${'1.0.2'}           | ${true}
    ${'["~ 1.0", loose=False, include_prerelease=False]'}                           | ${'1.0.2'}           | ${true}
    ${'[">=1", loose=False, include_prerelease=False]'}                             | ${'1.0.0'}           | ${true}
    ${'[">= 1", loose=False, include_prerelease=False]'}                            | ${'1.0.0'}           | ${true}
    ${'["<1.2", loose=False, include_prerelease=False]'}                            | ${'1.1.1'}           | ${true}
    ${'["< 1.2", loose=False, include_prerelease=False]'}                           | ${'1.1.1'}           | ${true}
    ${'["~v0.5.4-pre", loose=False, include_prerelease=False]'}                     | ${'0.5.5'}           | ${true}
    ${'["~v0.5.4-pre", loose=False, include_prerelease=False]'}                     | ${'0.5.4'}           | ${true}
    ${'["=0.7.x", loose=False, include_prerelease=False]'}                          | ${'0.7.2'}           | ${true}
    ${'["<=0.7.x", loose=False, include_prerelease=False]'}                         | ${'0.7.2'}           | ${true}
    ${'[">=0.7.x", loose=False, include_prerelease=False]'}                         | ${'0.7.2'}           | ${true}
    ${'["<=0.7.x", loose=False, include_prerelease=False]'}                         | ${'0.6.2'}           | ${true}
    ${'["~1.2.1 >=1.2.3", loose=False, include_prerelease=False]'}                  | ${'1.2.3'}           | ${true}
    ${'["~1.2.1 =1.2.3", loose=False, include_prerelease=False]'}                   | ${'1.2.3'}           | ${true}
    ${'["~1.2.1 1.2.3", loose=False, include_prerelease=False]'}                    | ${'1.2.3'}           | ${true}
    ${'["~1.2.1 >=1.2.3 1.2.3", loose=False, include_prerelease=False]'}            | ${'1.2.3'}           | ${true}
    ${'["~1.2.1 1.2.3 >=1.2.3", loose=False, include_prerelease=False]'}            | ${'1.2.3'}           | ${true}
    ${'["~1.2.1 1.2.3", loose=False, include_prerelease=False]'}                    | ${'1.2.3'}           | ${true}
    ${'[">1.1.0 <2.0.0", include_prerelease=True]'}                                 | ${'1.2.3-dev.1+abc'} | ${true}
    ${'["~ 1.0.3", loose=False, include_prerelease=False]'}                         | ${'1.0.12'}          | ${true}
    ${'[">=1.2.1 1.2.3", loose=False, include_prerelease=False]'}                   | ${'1.2.3'}           | ${true}
    ${'["1.2.3 >=1.2.1", loose=False, include_prerelease=False]'}                   | ${'1.2.3'}           | ${true}
    ${'[">=1.2.3 >=1.2.1", loose=False, include_prerelease=False]'}                 | ${'1.2.3'}           | ${true}
    ${'[">=1.2.1 >=1.2.3", loose=False, include_prerelease=False]'}                 | ${'1.2.3'}           | ${true}
    ${'[">=1.2", loose=False, include_prerelease=False]'}                           | ${'1.2.8'}           | ${true}
    ${'["^1.2.3", loose=False, include_prerelease=False]'}                          | ${'1.8.1'}           | ${true}
    ${'["^0.1.2", loose=False, include_prerelease=False]'}                          | ${'0.1.2'}           | ${true}
    ${'["^0.1", loose=False, include_prerelease=False]'}                            | ${'0.1.2'}           | ${true}
    ${'["^0.0.1", loose=False, include_prerelease=False]'}                          | ${'0.0.1'}           | ${true}
    ${'["^1.2", loose=False, include_prerelease=False]'}                            | ${'1.4.2'}           | ${true}
    ${'["^1.2 ^1", loose=False, include_prerelease=False]'}                         | ${'1.4.2'}           | ${true}
    ${'["^1.2.3-alpha", loose=False, include_prerelease=False]'}                    | ${'1.2.3-pre'}       | ${false}
    ${'["^1.2.3-alpha", loose=False, include_prerelease=True]'}                     | ${'1.2.4-pre'}       | ${true}
    ${'["^1.2.0-alpha", loose=False, include_prerelease=False]'}                    | ${'"1.2.0-pre'}      | ${false}
    ${'["^0.0.1-alpha", loose=False, include_prerelease=False]'}                    | ${'0.0.1-beta'}      | ${false}
    ${'["^0.1.1-alpha", loose=False, include_prerelease=False]'}                    | ${'"0.1.1-beta'}     | ${false}
    ${'["^x", loose=False, include_prerelease=False]'}                              | ${'1.2.3'}           | ${true}
    ${'["x - 1.0.0", loose=False, include_prerelease=False]'}                       | ${'0.9.7'}           | ${true}
    ${'["x - 1.x", loose=False, include_prerelease=False]'}                         | ${'0.9.7'}           | ${true}
    ${'["1.0.0 - x", loose=False, include_prerelease=False]'}                       | ${'1.9.7'}           | ${true}
    ${'["1.x - x", loose=False, include_prerelease=False]'}                         | ${'1.9.7'}           | ${true}
    ${'["<=7.x", loose=False, include_prerelease=False]'}                           | ${'7.9.9'}           | ${true}
    ${'[>1.1.0 <2.0.0]'}                                                            | ${'1.2.3-dev.1+abc'} | ${false}
    ${'[">1.0.0 <1.0.2", loose=False, include_prerelease=True]'}                    | ${'1.0.2-beta'}      | ${true}
    ${'[">1.1.0 <2.0.0", include_prerelease=False]'}                                | ${'1.2.3-dev.1+abc'} | ${false}
    ${'["1.0.0 - 2.0.0", loose=False]'}                                             | ${'2.2.3'}           | ${true}
    ${'["1.2.3+asdf - 2.4.3+asdf", loose=False]'}                                   | ${'1.2.3-pre.2'}     | ${false}
    ${'["1.2.3+asdf - 2.4.3+asdf", loose=False]'}                                   | ${'2.4.3-alpha'}     | ${false}
    ${'["^1.2.3+build", loose=False]'}                                              | ${'2.0.0'}           | ${true}
    ${'["^1.2.3+build", loose=False]'}                                              | ${'1.2.0'}           | ${false}
    ${'["^1.2.3", loose=False]'}                                                    | ${'1.2.3-pre'}       | ${false}
    ${'["^1.2", loose=False]'}                                                      | ${'1.2.0-pre'}       | ${false}
    ${'[">1.2", loose=False]'}                                                      | ${'1.3.0-beta'}      | ${false}
    ${'["<=1.2.3", loose=False]'}                                                   | ${'1.2.3-beta'}      | ${false}
    ${'["^1.2.3", loose=False]'}                                                    | ${'1.2.3-beta'}      | ${false}
    ${'["=0.7.x", loose=False]'}                                                    | ${'0.7.0-asdf'}      | ${false}
    ${'[">=0.7.x", loose=False]'}                                                   | ${'0.7.0-asdf'}      | ${false}
    ${'["1", loose=True]'}                                                          | ${'1.0.0beta'}       | ${false}
    ${'["<1", loose=True]'}                                                         | ${'1.0.0beta'}       | ${false}
    ${'["< 1", loose=True]'}                                                        | ${'1.0.0beta'}       | ${false}
    ${'["1.0.0", loose=False]'}                                                     | ${'1.0.1'}           | ${true}
    ${'[">=1.0.0", loose=False]'}                                                   | ${'0.0.0'}           | ${false}
    ${'[">=1.0.0", loose=False]'}                                                   | ${'0.0.1'}           | ${false}
    ${'[">=1.0.0", loose=False]'}                                                   | ${'0.1.0'}           | ${false}
    ${'[">1.0.0", loose=False]'}                                                    | ${'0.0.1'}           | ${false}
    ${'[">1.0.0", loose=False]'}                                                    | ${'0.1.0'}           | ${false}
    ${'["<=2.0.0", loose=False]'}                                                   | ${'3.0.0'}           | ${true}
    ${'["<=2.0.0", loose=False]'}                                                   | ${'2.9999.9999'}     | ${true}
    ${'["<=2.0.0", loose=False]'}                                                   | ${'2.2.9'}           | ${true}
    ${'["<2.0.0", loose=False]'}                                                    | ${'2.9999.9999'}     | ${true}
    ${'["<2.0.0", loose=False]'}                                                    | ${'2.2.9'}           | ${true}
    ${'[">=0.1.97", loose=True]'}                                                   | ${'v0.1.93'}         | ${false}
    ${'[">=0.1.97", loose=False]'}                                                  | ${'0.1.93'}          | ${false}
    ${'["0.1.20 || 1.2.4", loose=False]'}                                           | ${'1.2.3'}           | ${true}
    ${'[">=0.2.3 || <0.0.1", loose=False]'}                                         | ${'0.0.3'}           | ${true}
    ${'[">=0.2.3 || <0.0.1", loose=False]'}                                         | ${'0.2.2'}           | ${true}
    ${'["2.x.x", loose=False]'}                                                     | ${'1.1.3'}           | ${false}
    ${'["2.x.x", loose=False]'}                                                     | ${'3.1.3'}           | ${true}
    ${'["1.2.x", loose=False]'}                                                     | ${'1.3.3'}           | ${true}
    ${'["1.2.x || 2.x", loose=False]'}                                              | ${'3.1.3'}           | ${true}
    ${'["1.2.x || 2.x", loose=False]'}                                              | ${'1.1.3'}           | ${false}
    ${'["2.*.*", loose=False]'}                                                     | ${'1.1.3'}           | ${false}
    ${'["2.*.*", loose=False]'}                                                     | ${'3.1.3'}           | ${true}
    ${'["1.2.*", loose=False]'}                                                     | ${'1.3.3'}           | ${true}
    ${'["1.2.* || 2.*", loose=False]'}                                              | ${'3.1.3'}           | ${true}
    ${'["1.2.* || 2.*", loose=False]'}                                              | ${'1.1.3'}           | ${false}
    ${'["2", loose=False]'}                                                         | ${'1.1.2'}           | ${false}
    ${'["2.3", loose=False]'}                                                       | ${'2.4.1'}           | ${true}
    ${'["~2.4", loose=False]'}                                                      | ${'2.5.0'}           | ${true}
    ${'["~2.4", loose=False]'}                                                      | ${'2.3.9'}           | ${false}
    ${'["~>3.2.1", loose=False]'}                                                   | ${'3.3.2'}           | ${true}
    ${'["~>3.2.1", loose=False]'}                                                   | ${'3.2.0'}           | ${false}
    ${'["~1", loose=False]'}                                                        | ${'0.2.3'}           | ${false}
    ${'["~>1", loose=False]'}                                                       | ${'2.2.3'}           | ${true}
    ${'["~1.0", loose=False]'}                                                      | ${'1.1.0'}           | ${true}
    ${'["<1", loose=False]'}                                                        | ${'1.0.0'}           | ${true}
    ${'[">=1.2", loose=False]'}                                                     | ${'1.1.1'}           | ${false}
    ${'["1", loose=True]'}                                                          | ${'2.0.0beta'}       | ${false}
    ${'["~v0.5.4-beta", loose=False]'}                                              | ${'0.5.4-alpha'}     | ${false}
    ${'["=0.7.x", loose=False]'}                                                    | ${'0.8.2'}           | ${true}
    ${'[">=0.7.x", loose=False]'}                                                   | ${'0.6.2'}           | ${false}
    ${'["<0.7.x", loose=False]'}                                                    | ${'0.7.2'}           | ${true}
    ${'["<1.2.3", loose=False]'}                                                    | ${'1.2.3-beta'}      | ${false}
    ${'["=1.2.3", loose=False]'}                                                    | ${'1.2.3-beta'}      | ${false}
    ${'[">1.2", loose=False]'}                                                      | ${'1.2.8'}           | ${false}
    ${'["^0.0.1", loose=False]'}                                                    | ${'0.0.2'}           | ${true}
    ${'["^1.2.3", loose=False]'}                                                    | ${'2.0.0-alpha'}     | ${false}
    ${'["^1.2.3", loose=False]'}                                                    | ${'1.2.2'}           | ${false}
    ${'["^1.2", loose=False]'}                                                      | ${'1.1.9'}           | ${false}
    ${'["*", loose=True]'}                                                          | ${'v1.2.3-foo'}      | ${false}
    ${'["blerg", loose=False]'}                                                     | ${'1.2.3'}           | ${true}
    ${'["git+https: #user:password0123@github.com/foo", loose=True]'}               | ${'123.0.0'}         | ${true}
    ${'["^1.2.3", loose=False]'}                                                    | ${'2.0.0-pre'}       | ${false}
    ${'[~=1.18]'}                                                                   | ${'1.20.0'}          | ${true}
    ${'[0.2.0]'}                                                                    | ${'0.3.0'}           | ${true}
    ${'[~8.4.0, loose=False]'}                                                      | ${'8.5.0'}           | ${true}
    ${'[~=1.0 include_prerelease=True]'}                                            | ${'1.21.2'}          | ${true}
    ${'1.0.7'}                                                                      | ${'1.21.2'}          | ${true}
    ${'16.00'}                                                                      | ${'19.00'}           | ${true}
  `(
    'isCompatible("$version", "$range") === $result',
    ({ version, range, result }) => {
      const res = !!conan.isCompatible(version, range);
      expect(res).toBe(result);
    },
  );

  // matches(version: string, range: string | Range): string | boolean | null;
  it.each`
    range                                                                           | version              | result
    ${'[>1.1 <2.0]'}                                                                | ${'1.2.3'}           | ${true}
    ${'["~1.2.3", loose=False, include_prerelease=True]'}                           | ${'1.2.3-pre.1'}     | ${true}
    ${'["1.0.0 - 2.0.0", loose=False, include_prerelease=False]'}                   | ${'1.2.3'}           | ${true}
    ${'["^1.2.3+build", loose=False, include_prerelease=False]'}                    | ${'1.2.3'}           | ${true}
    ${'["^1.2.3+build", loose=False, include_prerelease=False]'}                    | ${'1.3.0'}           | ${true}
    ${'["1.2.3-pre+asdf - 2.4.3-pre+asdf", loose=False, include_prerelease=False]'} | ${'1.2.3'}           | ${true}
    ${'["1.2.3pre+asdf - 2.4.3-pre+asdf", loose=True, include_prerelease=False]'}   | ${'1.2.3'}           | ${true}
    ${'["1.2.3-pre+asdf - 2.4.3pre+asdf", loose=True, include_prerelease=False]'}   | ${'1.2.3'}           | ${true}
    ${'["1.2.3pre+asdf - 2.4.3pre+asdf", loose=True, include_prerelease=False]'}    | ${'1.2.3'}           | ${true}
    ${'["1.2.3-pre+asdf - 2.4.3-pre+asdf", loose=False, include_prerelease=False]'} | ${'1.2.3-pre.2'}     | ${true}
    ${'["1.2.3-pre+asdf - 2.4.3-pre+asdf", loose=False, include_prerelease=False]'} | ${'2.4.3-alpha'}     | ${true}
    ${'["1.2.3+asdf - 2.4.3+asdf", loose=False, include_prerelease=False]'}         | ${'1.2.3'}           | ${true}
    ${'["1.0.0", loose=False, include_prerelease=False]'}                           | ${'1.0.0'}           | ${true}
    ${'[">=*", loose=False, include_prerelease=False]'}                             | ${'0.2.4'}           | ${true}
    ${'["", loose=False, include_prerelease=False]'}                                | ${'1.0.0'}           | ${true}
    ${'["*", loose=False, include_prerelease=False]'}                               | ${'1.2.3'}           | ${true}
    ${'["*", loose=True, include_prerelease=False]'}                                | ${'v1.2.3'}          | ${true}
    ${'[">=1.0.0", loose=False, include_prerelease=False]'}                         | ${'1.0.0'}           | ${true}
    ${'[">=1.0.0", loose=False, include_prerelease=False]'}                         | ${'1.0.1'}           | ${true}
    ${'[">=1.0.0", loose=False, include_prerelease=False]'}                         | ${'1.1.0'}           | ${true}
    ${'[">1.0.0", loose=False, include_prerelease=False]'}                          | ${'1.0.1'}           | ${true}
    ${'[">1.0.0", loose=False, include_prerelease=True]'}                           | ${'1.0.1-pre.1'}     | ${true}
    ${'[">1.0.0", loose=False, include_prerelease=False]'}                          | ${'1.1.0'}           | ${true}
    ${'["<=2.0.0", loose=False, include_prerelease=False]'}                         | ${'2.0.0'}           | ${true}
    ${'["<=2.0.0", loose=False, include_prerelease=False]'}                         | ${'1.9999.9999'}     | ${true}
    ${'["<=2.0.0", loose=False, include_prerelease=False]'}                         | ${'0.2.9'}           | ${true}
    ${'["<2.0.0", loose=False, include_prerelease=False]'}                          | ${'1.9999.9999'}     | ${true}
    ${'["<2.0.0", loose=False, include_prerelease=False]'}                          | ${'0.2.9'}           | ${true}
    ${'[">= 1.0.0", loose=False, include_prerelease=False]'}                        | ${'1.0.0'}           | ${true}
    ${'[">=  1.0.0", loose=False, include_prerelease=False]'}                       | ${'1.0.1'}           | ${true}
    ${'[">=   1.0.0", loose=False, include_prerelease=False]'}                      | ${'1.1.0'}           | ${true}
    ${'["> 1.0.0", loose=False, include_prerelease=False]'}                         | ${'1.0.1'}           | ${true}
    ${'[">  1.0.0", loose=False, include_prerelease=False]'}                        | ${'1.1.0'}           | ${true}
    ${'["<=   2.0.0", loose=False, include_prerelease=False]'}                      | ${'2.0.0'}           | ${true}
    ${'["<= 2.0.0", loose=False, include_prerelease=False]'}                        | ${'1.9999.9999'}     | ${true}
    ${'["<=  2.0.0", loose=False, include_prerelease=False]'}                       | ${'0.2.9'}           | ${true}
    ${'["<    2.0.0", loose=False, include_prerelease=False]'}                      | ${'1.9999.9999'}     | ${true}
    ${'["<\t2.0.0", loose=False, include_prerelease=False]'}                        | ${'0.2.9'}           | ${true}
    ${'[">=0.1.97", loose=True, include_prerelease=False]'}                         | ${'v0.1.97'}         | ${true}
    ${'[">=0.1.97", loose=False, include_prerelease=False]'}                        | ${'0.1.97'}          | ${true}
    ${'["0.1.20 || 1.2.4", loose=False, include_prerelease=False]'}                 | ${'1.2.4'}           | ${true}
    ${'[">=0.2.3 || <0.0.1", loose=False, include_prerelease=False]'}               | ${'0.0.0'}           | ${true}
    ${'[">=0.2.3 || <0.0.1", loose=False, include_prerelease=False]'}               | ${'0.2.3'}           | ${true}
    ${'[">=0.2.3 || <0.0.1", loose=False, include_prerelease=False]'}               | ${'0.2.4'}           | ${true}
    ${'["||", loose=False, include_prerelease=False]'}                              | ${'1.3.4'}           | ${true}
    ${'["2.x.x", loose=False, include_prerelease=False]'}                           | ${'2.1.3'}           | ${true}
    ${'["1.2.x", loose=False, include_prerelease=False]'}                           | ${'1.2.3'}           | ${true}
    ${'["1.2.x || 2.x", loose=False, include_prerelease=False]'}                    | ${'2.1.3'}           | ${true}
    ${'["1.2.x || 2.x", loose=False, include_prerelease=False]'}                    | ${'1.2.3'}           | ${true}
    ${'["x", loose=False, include_prerelease=False]'}                               | ${'1.2.3'}           | ${true}
    ${'["2.*.*", loose=False, include_prerelease=False]'}                           | ${'2.1.3'}           | ${true}
    ${'["1.2.*", loose=False, include_prerelease=False]'}                           | ${'1.2.3'}           | ${true}
    ${'["1.2.* || 2.*", loose=False, include_prerelease=False]'}                    | ${'2.1.3'}           | ${true}
    ${'["1.2.* || 2.*", loose=False, include_prerelease=False]'}                    | ${'1.2.3'}           | ${true}
    ${'["*", loose=False, include_prerelease=False]'}                               | ${'1.2.3'}           | ${true}
    ${'["2", loose=False, include_prerelease=False]'}                               | ${'2.1.2'}           | ${true}
    ${'["2.3", loose=False, include_prerelease=False]'}                             | ${'2.3.1'}           | ${true}
    ${'["~x", loose=False, include_prerelease=False]'}                              | ${'0.0.9'}           | ${true}
    ${'["~2", loose=False, include_prerelease=False]'}                              | ${'2.0.9'}           | ${true}
    ${'["~2.4", loose=False, include_prerelease=False]'}                            | ${'2.4.0'}           | ${true}
    ${'["~2.4", loose=False, include_prerelease=False]'}                            | ${'2.4.5'}           | ${true}
    ${'["~>3.2.1", loose=False, include_prerelease=False]'}                         | ${'3.2.2'}           | ${true}
    ${'["~1", loose=False, include_prerelease=False]'}                              | ${'1.2.3'}           | ${true}
    ${'["~>1", loose=False, include_prerelease=False]'}                             | ${'1.2.3'}           | ${true}
    ${'["~> 1", loose=False, include_prerelease=False]'}                            | ${'1.2.3'}           | ${true}
    ${'["~1.0", loose=False, include_prerelease=False]'}                            | ${'1.0.2'}           | ${true}
    ${'["~ 1.0", loose=False, include_prerelease=False]'}                           | ${'1.0.2'}           | ${true}
    ${'[">=1", loose=False, include_prerelease=False]'}                             | ${'1.0.0'}           | ${true}
    ${'[">= 1", loose=False, include_prerelease=False]'}                            | ${'1.0.0'}           | ${true}
    ${'["<1.2", loose=False, include_prerelease=False]'}                            | ${'1.1.1'}           | ${true}
    ${'["< 1.2", loose=False, include_prerelease=False]'}                           | ${'1.1.1'}           | ${true}
    ${'["~v0.5.4-pre", loose=False, include_prerelease=False]'}                     | ${'0.5.5'}           | ${true}
    ${'["~v0.5.4-pre", loose=False, include_prerelease=False]'}                     | ${'0.5.4'}           | ${true}
    ${'["=0.7.x", loose=False, include_prerelease=False]'}                          | ${'0.7.2'}           | ${true}
    ${'["<=0.7.x", loose=False, include_prerelease=False]'}                         | ${'0.7.2'}           | ${true}
    ${'[">=0.7.x", loose=False, include_prerelease=False]'}                         | ${'0.7.2'}           | ${true}
    ${'["<=0.7.x", loose=False, include_prerelease=False]'}                         | ${'0.6.2'}           | ${true}
    ${'["~1.2.1 >=1.2.3", loose=False, include_prerelease=False]'}                  | ${'1.2.3'}           | ${true}
    ${'["~1.2.1 =1.2.3", loose=False, include_prerelease=False]'}                   | ${'1.2.3'}           | ${true}
    ${'["~1.2.1 1.2.3", loose=False, include_prerelease=False]'}                    | ${'1.2.3'}           | ${true}
    ${'["~1.2.1 >=1.2.3 1.2.3", loose=False, include_prerelease=False]'}            | ${'1.2.3'}           | ${true}
    ${'["~1.2.1 1.2.3 >=1.2.3", loose=False, include_prerelease=False]'}            | ${'1.2.3'}           | ${true}
    ${'["~1.2.1 1.2.3", loose=False, include_prerelease=False]'}                    | ${'1.2.3'}           | ${true}
    ${'[">1.1.0 <2.0.0", include_prerelease=True]'}                                 | ${'1.2.3-dev.1+abc'} | ${true}
    ${'["~ 1.0.3", loose=False, include_prerelease=False]'}                         | ${'1.0.12'}          | ${true}
    ${'[">=1.2.1 1.2.3", loose=False, include_prerelease=False]'}                   | ${'1.2.3'}           | ${true}
    ${'["1.2.3 >=1.2.1", loose=False, include_prerelease=False]'}                   | ${'1.2.3'}           | ${true}
    ${'[">=1.2.3 >=1.2.1", loose=False, include_prerelease=False]'}                 | ${'1.2.3'}           | ${true}
    ${'[">=1.2.1 >=1.2.3", loose=False, include_prerelease=False]'}                 | ${'1.2.3'}           | ${true}
    ${'[">=1.2", loose=False, include_prerelease=False]'}                           | ${'1.2.8'}           | ${true}
    ${'["^1.2.3", loose=False, include_prerelease=False]'}                          | ${'1.8.1'}           | ${true}
    ${'["^0.1.2", loose=False, include_prerelease=False]'}                          | ${'0.1.2'}           | ${true}
    ${'["^0.1", loose=False, include_prerelease=False]'}                            | ${'0.1.2'}           | ${true}
    ${'["^0.0.1", loose=False, include_prerelease=False]'}                          | ${'0.0.1'}           | ${true}
    ${'["^1.2", loose=False, include_prerelease=False]'}                            | ${'1.4.2'}           | ${true}
    ${'["^1.2 ^1", loose=False, include_prerelease=False]'}                         | ${'1.4.2'}           | ${true}
    ${'["^1.2.3-alpha", loose=False, include_prerelease=False]'}                    | ${'1.2.3-pre'}       | ${true}
    ${'["^1.2.3-alpha", loose=False, include_prerelease=True]'}                     | ${'1.2.4-pre'}       | ${true}
    ${'["^1.2.0-alpha", loose=False, include_prerelease=False]'}                    | ${'"1.2.0-pre'}      | ${true}
    ${'["^0.0.1-alpha", loose=False, include_prerelease=False]'}                    | ${'0.0.1-beta'}      | ${true}
    ${'["^0.1.1-alpha", loose=False, include_prerelease=False]'}                    | ${'"0.1.1-beta'}     | ${true}
    ${'["^x", loose=False, include_prerelease=False]'}                              | ${'1.2.3'}           | ${true}
    ${'["x - 1.0.0", loose=False, include_prerelease=False]'}                       | ${'0.9.7'}           | ${true}
    ${'["x - 1.x", loose=False, include_prerelease=False]'}                         | ${'0.9.7'}           | ${true}
    ${'["1.0.0 - x", loose=False, include_prerelease=False]'}                       | ${'1.9.7'}           | ${true}
    ${'["1.x - x", loose=False, include_prerelease=False]'}                         | ${'1.9.7'}           | ${true}
    ${'["<=7.x", loose=False, include_prerelease=False]'}                           | ${'7.9.9'}           | ${true}
    ${'[>1.1.0 <2.0.0]'}                                                            | ${'1.2.3-dev.1+abc'} | ${false}
    ${'[">1.0.0 <1.0.2", loose=False, include_prerelease=True]'}                    | ${'1.0.2-beta'}      | ${false}
    ${'[">1.1.0 <2.0.0", include_prerelease=False]'}                                | ${'1.2.3-dev.1+abc'} | ${false}
    ${'["1.0.0 - 2.0.0", loose=False]'}                                             | ${'2.2.3'}           | ${false}
    ${'["1.2.3+asdf - 2.4.3+asdf", loose=False]'}                                   | ${'1.2.3-pre.2'}     | ${false}
    ${'["1.2.3+asdf - 2.4.3+asdf", loose=False]'}                                   | ${'2.4.3-alpha'}     | ${false}
    ${'["^1.2.3+build", loose=False]'}                                              | ${'2.0.0'}           | ${false}
    ${'["^1.2.3+build", loose=False]'}                                              | ${'1.2.0'}           | ${false}
    ${'["^1.2.3", loose=False]'}                                                    | ${'1.2.3-pre'}       | ${false}
    ${'["^1.2", loose=False]'}                                                      | ${'1.2.0-pre'}       | ${false}
    ${'[">1.2", loose=False]'}                                                      | ${'1.3.0-beta'}      | ${false}
    ${'["<=1.2.3", loose=False]'}                                                   | ${'1.2.3-beta'}      | ${false}
    ${'["^1.2.3", loose=False]'}                                                    | ${'1.2.3-beta'}      | ${false}
    ${'["=0.7.x", loose=False]'}                                                    | ${'0.7.0-asdf'}      | ${false}
    ${'[">=0.7.x", loose=False]'}                                                   | ${'0.7.0-asdf'}      | ${false}
    ${'["1", loose=True]'}                                                          | ${'1.0.0beta'}       | ${false}
    ${'["<1", loose=True]'}                                                         | ${'1.0.0beta'}       | ${false}
    ${'["< 1", loose=True]'}                                                        | ${'1.0.0beta'}       | ${false}
    ${'["1.0.0", loose=False]'}                                                     | ${'1.0.1'}           | ${false}
    ${'[">=1.0.0", loose=False]'}                                                   | ${'0.0.0'}           | ${false}
    ${'[">=1.0.0", loose=False]'}                                                   | ${'0.0.1'}           | ${false}
    ${'[">=1.0.0", loose=False]'}                                                   | ${'0.1.0'}           | ${false}
    ${'[">1.0.0", loose=False]'}                                                    | ${'0.0.1'}           | ${false}
    ${'[">1.0.0", loose=False]'}                                                    | ${'0.1.0'}           | ${false}
    ${'["<=2.0.0", loose=False]'}                                                   | ${'3.0.0'}           | ${false}
    ${'["<=2.0.0", loose=False]'}                                                   | ${'2.9999.9999'}     | ${false}
    ${'["<=2.0.0", loose=False]'}                                                   | ${'2.2.9'}           | ${false}
    ${'["<2.0.0", loose=False]'}                                                    | ${'2.9999.9999'}     | ${false}
    ${'["<2.0.0", loose=False]'}                                                    | ${'2.2.9'}           | ${false}
    ${'[">=0.1.97", loose=True]'}                                                   | ${'v0.1.93'}         | ${false}
    ${'[">=0.1.97", loose=False]'}                                                  | ${'0.1.93'}          | ${false}
    ${'["0.1.20 || 1.2.4", loose=False]'}                                           | ${'1.2.3'}           | ${false}
    ${'[">=0.2.3 || <0.0.1", loose=False]'}                                         | ${'0.0.3'}           | ${false}
    ${'[">=0.2.3 || <0.0.1", loose=False]'}                                         | ${'0.2.2'}           | ${false}
    ${'["2.x.x", loose=False]'}                                                     | ${'1.1.3'}           | ${false}
    ${'["2.x.x", loose=False]'}                                                     | ${'3.1.3'}           | ${false}
    ${'["1.2.x", loose=False]'}                                                     | ${'1.3.3'}           | ${false}
    ${'["1.2.x || 2.x", loose=False]'}                                              | ${'3.1.3'}           | ${false}
    ${'["1.2.x || 2.x", loose=False]'}                                              | ${'1.1.3'}           | ${false}
    ${'["2.*.*", loose=False]'}                                                     | ${'1.1.3'}           | ${false}
    ${'["2.*.*", loose=False]'}                                                     | ${'3.1.3'}           | ${false}
    ${'["1.2.*", loose=False]'}                                                     | ${'1.3.3'}           | ${false}
    ${'["1.2.* || 2.*", loose=False]'}                                              | ${'3.1.3'}           | ${false}
    ${'["1.2.* || 2.*", loose=False]'}                                              | ${'1.1.3'}           | ${false}
    ${'["2", loose=False]'}                                                         | ${'1.1.2'}           | ${false}
    ${'["2.3", loose=False]'}                                                       | ${'2.4.1'}           | ${false}
    ${'["~2.4", loose=False]'}                                                      | ${'2.5.0'}           | ${false}
    ${'["~2.4", loose=False]'}                                                      | ${'2.3.9'}           | ${false}
    ${'["~>3.2.1", loose=False]'}                                                   | ${'3.3.2'}           | ${false}
    ${'["~>3.2.1", loose=False]'}                                                   | ${'3.2.0'}           | ${false}
    ${'["~1", loose=False]'}                                                        | ${'0.2.3'}           | ${false}
    ${'["~>1", loose=False]'}                                                       | ${'2.2.3'}           | ${false}
    ${'["~1.0", loose=False]'}                                                      | ${'1.1.0'}           | ${false}
    ${'["<1", loose=False]'}                                                        | ${'1.0.0'}           | ${false}
    ${'[">=1.2", loose=False]'}                                                     | ${'1.1.1'}           | ${false}
    ${'["1", loose=True]'}                                                          | ${'2.0.0beta'}       | ${false}
    ${'["~v0.5.4-beta", loose=False]'}                                              | ${'0.5.4-alpha'}     | ${false}
    ${'["=0.7.x", loose=False]'}                                                    | ${'0.8.2'}           | ${false}
    ${'[">=0.7.x", loose=False]'}                                                   | ${'0.6.2'}           | ${false}
    ${'["<0.7.x", loose=False]'}                                                    | ${'0.7.2'}           | ${false}
    ${'["<1.2.3", loose=False]'}                                                    | ${'1.2.3-beta'}      | ${false}
    ${'["=1.2.3", loose=False]'}                                                    | ${'1.2.3-beta'}      | ${false}
    ${'[">1.2", loose=False]'}                                                      | ${'1.2.8'}           | ${false}
    ${'["^0.0.1", loose=False]'}                                                    | ${'0.0.2'}           | ${false}
    ${'["^1.2.3", loose=False]'}                                                    | ${'2.0.0-alpha'}     | ${false}
    ${'["^1.2.3", loose=False]'}                                                    | ${'1.2.2'}           | ${false}
    ${'["^1.2", loose=False]'}                                                      | ${'1.1.9'}           | ${false}
    ${'["*", loose=True]'}                                                          | ${'v1.2.3-foo'}      | ${false}
    ${'["blerg", loose=False]'}                                                     | ${'1.2.3'}           | ${false}
    ${'["git+https: #user:password0123@github.com/foo", loose=True]'}               | ${'123.0.0'}         | ${false}
    ${'["^1.2.3", loose=False]'}                                                    | ${'2.0.0-pre'}       | ${false}
    ${'[~=1.18]'}                                                                   | ${'1.20.0'}          | ${false}
    ${'[0.2.0]'}                                                                    | ${'0.3.0'}           | ${false}
    ${'[~8.4.0, loose=False]'}                                                      | ${'8.5.0'}           | ${false}
    ${'[~=1.0 include_prerelease=True]'}                                            | ${'1.21.2'}          | ${false}
    ${'1.0.7'}                                                                      | ${'1.21.2'}          | ${true}
    ${'16.00'}                                                                      | ${'19.00'}           | ${true}
  `(
    'matches("$version", "$range") === $result',
    ({ version, range, result }) => {
      const res = !!conan.matches(version, range);
      expect(res).toBe(result);
    },
  );

  // isStable(version: string): boolean;
  it.each`
    version                                          | result
    ${'5.0.1'}                                       | ${true}
    ${'19.00'}                                       | ${true}
    ${'1.0.7-prerelease.1'}                          | ${false}
    ${'1.0.7-prerelease.1, include_prerelease=True'} | ${true}
  `('isStable("$version") === $result', ({ version, result }) => {
    const res = conan.isStable(version);
    expect(res).toBe(result);
  });

  // getNewValue(newValueConfig: NewValueConfig): string;
  it.each`
    currentValue                                          | rangeStrategy | currentVersion                     | newVersion                         | result
    ${'[<=1.2.3]'}                                        | ${'widen'}    | ${'1.0.0'}                         | ${'1.2.3'}                         | ${'[<=1.2.3]'}
    ${'[<1.2.3]'}                                         | ${'widen'}    | ${'1.5.5'}                         | ${'1.5.6'}                         | ${'[<1.5.7]'}
    ${'[>1.2.7 >3.0.0 5.0]'}                              | ${'widen'}    | ${'0.1.21'}                        | ${'0.1.24'}                        | ${'[>1.2.7 >3.0.0 5.0 || 0.1.24]'}
    ${'[>=1.2.7 >3.0.0 >5.0]'}                            | ${'widen'}    | ${'0.1.21'}                        | ${'0.1.24'}                        | ${null}
    ${'[>=1.2.7]'}                                        | ${'widen'}    | ${'0.1.21'}                        | ${'0.1.24'}                        | ${'[>=1.2.7 || 0.1.24]'}
    ${'[<= 1.2.3]'}                                       | ${'widen'}    | ${'1.0.0'}                         | ${'1.2.4'}                         | ${'[<= 1.2.4]'}
    ${'[4.5.5 - 1.2.3 - 2.0]'}                            | ${'widen'}    | ${'1.0.0'}                         | ${'1.4.8'}                         | ${'[4.5.5 - 1.2.3 - 1.4.8]'}
    ${'1.0.0'}                                            | ${'replace'}  | ${'1.0.0'}                         | ${'1.1.0'}                         | ${'1.1.0'}
    ${'[<1.0.0]'}                                         | ${'replace'}  | ${'1.0.0'}                         | ${'2.1.0'}                         | ${'[<3.0.0]'}
    ${'[<1.1]'}                                           | ${'replace'}  | ${'1.0.0'}                         | ${'2.1.0'}                         | ${'[<2.2]'}
    ${'[1.0.*]'}                                          | ${'replace'}  | ${'1.0.0'}                         | ${'1.1.0'}                         | ${'[1.1.*]'}
    ${'[1.*]'}                                            | ${'replace'}  | ${'1.0.0'}                         | ${'2.1.0'}                         | ${'[2.*]'}
    ${'[1.0.x]'}                                          | ${'replace'}  | ${'1.0.0'}                         | ${'1.1.0'}                         | ${'[1.1.x]'}
    ${'[1.x]'}                                            | ${'replace'}  | ${'1.0.0'}                         | ${'2.1.0'}                         | ${'[2.x]'}
    ${'[~0.6]'}                                           | ${'replace'}  | ${'0.6.8'}                         | ${'0.7.0'}                         | ${'[~0.7.0]'}
    ${'[~0.6.1]'}                                         | ${'replace'}  | ${'0.7.0'}                         | ${'0.7.0-rc.2'}                    | ${'[~0.7.0-rc]'}
    ${'[~>0.6.1]'}                                        | ${'replace'}  | ${'0.7.0'}                         | ${'0.7.0-rc.2'}                    | ${'[~> 0.7.0]'}
    ${'[<=1.2]'}                                          | ${'replace'}  | ${'1.0.0'}                         | ${'1.2.3'}                         | ${'[<=1.2]'}
    ${'[<=1]'}                                            | ${'replace'}  | ${'1.0.0'}                         | ${'1.2.3'}                         | ${'[<=1]'}
    ${'[<1.6.11]'}                                        | ${'replace'}  | ${'0.6.14'}                        | ${'1.6.14'}                        | ${'[<1.6.15]'}
    ${'[0.2.0]'}                                          | ${'replace'}  | ${'0.6.14'}                        | ${'0.3.0'}                         | ${'[0.3.0]'}
    ${'[< 1]'}                                            | ${'replace'}  | ${'1.0.0'}                         | ${'1.0.1'}                         | ${'[< 2]'}
    ${'[<3.6 loose=False, include_prerelease=True]'}      | ${'replace'}  | ${'0.1'}                           | ${'3.7.0'}                         | ${'[<3.8 loose=False, include_prerelease=True]'}
    ${'[<1.8 loose=False]'}                               | ${'replace'}  | ${'0.2'}                           | ${'1.17.1'}                        | ${'[<1.18 loose=False]'}
    ${'[=8.4.0]'}                                         | ${'replace'}  | ${'0.6.14'}                        | ${'8.5.0'}                         | ${'[=8.5.0]'}
    ${'[>8.0.0]'}                                         | ${'replace'}  | ${'0.6.14'}                        | ${'8.5.0'}                         | ${'[>9.0.0]'}
    ${'[>8]'}                                             | ${'replace'}  | ${'0.6.14'}                        | ${'8.5.0'}                         | ${'[>8]'}
    ${'[> 8]'}                                            | ${'replace'}  | ${'0.6.14'}                        | ${'8.5.0'}                         | ${'[>8]'}
    ${'5.0.1'}                                            | ${'pin'}      | ${'5.0.1'}                         | ${'5.0.7'}                         | ${'5.0.7'}
    ${'2.1'}                                              | ${'pin'}      | ${'2.1'}                           | ${'3.1'}                           | ${'3.1'}
    ${'0.1'}                                              | ${'pin'}      | ${'0.1'}                           | ${'2.7.1'}                         | ${'2.7.1'}
    ${'0.2'}                                              | ${'pin'}      | ${'0.2'}                           | ${'3.6.5'}                         | ${'3.6.5'}
    ${'1.0'}                                              | ${'pin'}      | ${'1.0'}                           | ${'1.0.0'}                         | ${'1.0.0'}
    ${'2.1'}                                              | ${'pin'}      | ${'2.1'}                           | ${'11.0.12'}                       | ${'11.0.12'}
    ${'0.1'}                                              | ${'pin'}      | ${'0.1'}                           | ${'3.5.0'}                         | ${'3.5.0'}
    ${'2.1'}                                              | ${'pin'}      | ${'2.1'}                           | ${'1.19.0'}                        | ${'1.19.0'}
    ${'1.15.0'}                                           | ${'pin'}      | ${'1.15.0'}                        | ${'1.42.0'}                        | ${'1.42.0'}
    ${'1.0'}                                              | ${'pin'}      | ${'1.0'}                           | ${'1.10.2'}                        | ${'1.10.2'}
    ${'0.2'}                                              | ${'pin'}      | ${'0.2'}                           | ${'1.1.9'}                         | ${'1.1.9'}
    ${'2.2'}                                              | ${'pin'}      | ${'2.2'}                           | ${'1.21.1'}                        | ${'1.21.1'}
    ${'1.2'}                                              | ${'pin'}      | ${'1.2'}                           | ${'1.12.20'}                       | ${'1.12.20'}
    ${'16.00'}                                            | ${'pin'}      | ${'16.00'}                         | ${'19.00'}                         | ${'19.00'}
    ${'2.9.2'}                                            | ${'pin'}      | ${'2.9.2'}                         | ${'2.13.7'}                        | ${'2.13.7'}
    ${'[^0.5.12]'}                                        | ${'pin'}      | ${'0.5.12'}                        | ${'0.5.13'}                        | ${'0.5.13'}
    ${'0.5.12'}                                           | ${'pin'}      | ${'0.5.12'}                        | ${'0.5.13'}                        | ${'0.5.13'}
    ${'5.0.20210712-T1759Z+b563c1478'}                    | ${'pin'}      | ${'5.0.20210712-T1759Z+b563c1478'} | ${'5.0.20211022-T0612Z+743f9e41b'} | ${'5.0.20211022-T0612Z+743f9e41b'}
    ${'[=8.4.0]'}                                         | ${'bump'}     | ${'0.6.14'}                        | ${'8.5.0'}                         | ${'[=8.5.0]'}
    ${'[~8.4.0, loose=False]'}                            | ${'bump'}     | ${'0.6.14'}                        | ${'8.5.0'}                         | ${'[~8.5.0, loose=False]'}
    ${'[~0.7.15, loose=False, include_prerelease=True]'}  | ${'bump'}     | ${'0.6.14'}                        | ${'0.9.7'}                         | ${'[~0.9.7, loose=False, include_prerelease=True]'}
    ${'[~=1.0 include_prerelease=True]'}                  | ${'bump'}     | ${'0.2'}                           | ${'1.21.1'}                        | ${'[~=1.21 include_prerelease=True]'}
    ${'[~=1.18]'}                                         | ${'bump'}     | ${'0.6.14'}                        | ${'1.20.0'}                        | ${'[~=1.20]'}
    ${'[0.2.0]'}                                          | ${'bump'}     | ${'0.6.14'}                        | ${'0.3.0'}                         | ${'[0.3.0]'}
    ${'[~1]'}                                             | ${'bump'}     | ${'2'}                             | ${'1.1.7'}                         | ${'[~1]'}
    ${'[~1]'}                                             | ${'bump'}     | ${'1.0.0'}                         | ${'2.1.7'}                         | ${'[~2]'}
    ${'[~1.0]'}                                           | ${'bump'}     | ${'1.0.0'}                         | ${'1.1.7'}                         | ${'[~1.1]'}
    ${'[~1.0.0]'}                                         | ${'bump'}     | ${'1.0.0'}                         | ${'1.1.7'}                         | ${'[~1.1.7]'}
    ${'[~1.0]'}                                           | ${'bump'}     | ${'1.0.0'}                         | ${'1.0.7-prerelease.1'}            | ${'[~1.0.7-prerelease.1]'}
    ${'[~1.0.7-prerelease.1]'}                            | ${'bump'}     | ${'1.0.0'}                         | ${'1.0.7-prerelease.1'}            | ${'[~1.0.7-prerelease.1]'}
    ${'[5]'}                                              | ${'bump'}     | ${'5.0.0'}                         | ${'6.1.7'}                         | ${'[6]'}
    ${'[>=1.0.0]'}                                        | ${'bump'}     | ${'1.0.0'}                         | ${'1.1.0'}                         | ${'[>=1.1.0]'}
    ${'[<1.0.0]'}                                         | ${'bump'}     | ${'1.0.0'}                         | ${'1.1.0'}                         | ${'[<1.0.0]'}
    ${'[>1.1 <3.0, include_prerelease=True]'}             | ${'bump'}     | ${'0.6.14'}                        | ${'1.1.1l'}                        | ${'[>1.1 <3.0, include_prerelease=True]'}
    ${'[>= 0.0.1 < 1]'}                                   | ${'bump'}     | ${'1.0.0'}                         | ${'1.0.1'}                         | ${'[>= 1.0.1 < 2]'}
    ${'[>3.0 <3.6 loose=False, include_prerelease=True]'} | ${'bump'}     | ${'0.1'}                           | ${'3.7.0'}                         | ${'[>3.7 <3.8 loose=False, include_prerelease=True]'}
    ${'[>1.0 <1.8 loose=False]'}                          | ${'bump'}     | ${'0.2'}                           | ${'1.17.1'}                        | ${'[>1.17 <1.18 loose=False]'}
    ${'[>0.6.7 <1.6.11]'}                                 | ${'bump'}     | ${'0.6.14'}                        | ${'1.6.14'}                        | ${'[>1.6.14 <1.6.15]'}
    ${'[3.17.2 || 3.15.7]'}                               | ${'bump'}     | ${'0.6.14'}                        | ${'3.21.3'}                        | ${'[3.17.2 || 3.15.7 || 3.21.3]'}
    ${'[>3.17.2 || 3.15.7]'}                              | ${'bump'}     | ${'0.6.14'}                        | ${'3.21.3'}                        | ${'[>3.21.3 || 3.15.7]'}
    ${'[1.69.0 || >=1.71.0 <1.76.0]'}                     | ${'bump'}     | ${'0.6.14'}                        | ${'1.76.0'}                        | ${'[1.69.0 || >=1.76.0 <1.76.1]'}
  `(
    'getNewValue("$currentValue", "$rangeStrategy", "$currentVersion", "$newVersion") === "$result"',
    ({ currentValue, rangeStrategy, currentVersion, newVersion, result }) => {
      const res = conan.getNewValue({
        currentValue,
        rangeStrategy,
        currentVersion,
        newVersion,
      });
      expect(res).toEqual(result);
    },
  );

  // getSatisfyingVersion(versions: string[], range: string): string | null;
  it.each`
    versions                                                                                   | range                                                              | result
    ${['1.2.4', '1.2.3', '1.2.5-beta']}                                                        | ${'["~1.2.3", loose=False, include_prerelease=True]'}              | ${'1.2.5-beta'}
    ${['1.2.4', '1.2.3', '1.2.5-beta']}                                                        | ${'["~1.2.3", loose=False, include_prerelease=False]'}             | ${'1.2.4'}
    ${['1.2.3', '1.2.4']}                                                                      | ${'["1.2", loose=False, include_prerelease=False]'}                | ${'1.2.4'}
    ${['1.2.4', '1.2.3']}                                                                      | ${'["1.2", loose=False, include_prerelease=False]'}                | ${'1.2.4'}
    ${['1.2.3', '1.2.4', '1.2.5', '1.2.6']}                                                    | ${'["~1.2.3", loose=False, include_prerelease=False]'}             | ${'1.2.6'}
    ${['1.0.1-beta']}                                                                          | ${'["1.x", loose=False, include_prerelease=False]'}                | ${null}
    ${['1.0.1-beta']}                                                                          | ${'["1.x", loose=False, include_prerelease=True]'}                 | ${'1.0.1-beta'}
    ${['1.0.0-beta']}                                                                          | ${'["1.x", loose=False, include_prerelease=True]'}                 | ${'1.0.0-beta'}
    ${['1.1.0-beta']}                                                                          | ${'["1.0.x", loose=False, include_prerelease=True]'}               | ${null}
    ${['1.0.0-beta', '1.1.0-beta', '1.1.0']}                                                   | ${'["1.0.x", loose=False, include_prerelease=False]'}              | ${null}
    ${['1.0.0-beta', '1.1.0-beta', '1.1.0']}                                                   | ${'["1.0.x", loose=False, include_prerelease=True]'}               | ${'1.0.0-beta'}
    ${['1.0.0-beta', '1.0.0', '1.0.1-beta', '1.0.2-beta']}                                     | ${'[">1.0.0 <1.0.2", loose=False, include_prerelease=False]'}      | ${null}
    ${['1.0.0-beta', '1.0.0', '1.0.1-beta', '1.0.2-beta']}                                     | ${'[">1.0.0 <1.0.2", loose=False, include_prerelease=True]'}       | ${'1.0.1-beta'}
    ${['1.0.0-beta', '1.0.0', '1.0.1', '1.1.0-beta', '1.1.0']}                                 | ${'[">1.0.0 <1.1.0", loose=False, include_prerelease=False]'}      | ${'1.0.1'}
    ${['1.0.0-beta', '1.0.0', '1.0.1', '1.1.0-beta', '1.1.0']}                                 | ${'[">1.0.0 <1.1.0", loose=False, include_prerelease=True]'}       | ${'1.0.1'}
    ${['1.0.0-beta', '1.1.0-beta']}                                                            | ${'[">1.0.0 <1.1.0", loose=False, include_prerelease=True]'}       | ${null}
    ${['1.0.0-beta', '1.1.0-beta', '1.0.0']}                                                   | ${'[">=1.0.0 <=1.0.1", loose=False, include_prerelease=False]'}    | ${'1.0.0'}
    ${['1.0.0-beta', '1.1.0-beta', '1.0.0']}                                                   | ${'[">=1.0.0 <=1.0.1", loose=False, include_prerelease=True]'}     | ${'1.0.0'}
    ${['1.0.0-beta', '1.0.0', '1.0.1', '1.1.0-beta']}                                          | ${'[">=1.0.0 <=1.1.0", loose=False, include_prerelease=False]'}    | ${'1.0.1'}
    ${['1.0.0-beta', '1.0.0', '1.0.1', '1.1.0-beta']}                                          | ${'[">=1.0.0 <=1.1.0", loose=False, include_prerelease=True]'}     | ${'1.1.0-beta'}
    ${['1.0.0-beta', '1.0.0', '1.0.1', '1.1.0-beta']}                                          | ${'[">=1.0.0 <1.1.0", loose=False, include_prerelease=False]'}     | ${'1.0.1'}
    ${['1.0.0-beta', '1.0.0', '1.0.1', '1.1.0-beta']}                                          | ${'[">=1.0.0 <1.1.0", loose=False, include_prerelease=True]'}      | ${'1.0.1'}
    ${['1.0.0-beta', '1.1.0-beta']}                                                            | ${'[">=1.0.0 <=1.1.0", loose=False, include_prerelease=False]'}    | ${null}
    ${['1.0.0-beta', '1.1.0-beta']}                                                            | ${'[">=1.0.0 <=1.1.0", loose=False, include_prerelease=True]'}     | ${'1.1.0-beta'}
    ${['1.0.0-beta', '1.1.0-beta', '1.0.0']}                                                   | ${'[">=1.0.0-0 <1.0.1", loose=False, include_prerelease=True]'}    | ${'1.0.0'}
    ${['1.0.0-beta', '1.1.0-beta', '1.1.0']}                                                   | ${'[">=1.0.0-0 <1.1.0-0", loose=False, include_prerelease=True]'}  | ${'1.0.0-beta'}
    ${['1.0.0-beta', '1.0.0', '1.0.1', '1.1.0-beta', '1.1.0']}                                 | ${'[">=1.0.0-0 <1.1.0-0", loose=False, include_prerelease=False]'} | ${'1.0.1'}
    ${['1.0.0-beta', '1.0.0', '1.0.1', '1.1.0-beta', '1.1.0']}                                 | ${'[">=1.0.0-0 <1.1.0-0", loose=False, include_prerelease=True]'}  | ${'1.0.1'}
    ${['1.0.0-beta', '1.1.0-beta']}                                                            | ${'[">=1.0.0-0 <1.1.0", loose=False, include_prerelease=True]'}    | ${'1.0.0-beta'}
    ${['1.0.0-pre']}                                                                           | ${'[1.0.x", loose=False, include_prerelease=True]'}                | ${'1.0.0-pre'}
    ${['1.0.0-pre']}                                                                           | ${'[">=1.0.x", loose=False, include_prerelease=True]'}             | ${'1.0.0-pre'}
    ${['1.1.0-pre']}                                                                           | ${'[">=1.0.0 <1.1.1-z", loose=False, include_prerelease=False]'}   | ${null}
    ${['1.2.3', '1.2.4', '1.2.5', '1.2.6', '2.0.1']}                                           | ${'["~1.2.3", loose=False]'}                                       | ${'1.2.6'}
    ${['1.1.0', '1.2.0', '1.3.0', '2.0.0b1', '2.0.0b3', '2.0.0', '2.1.0']}                     | ${'[~2.0.0]'}                                                      | ${'2.0.0'}
    ${['1.1.0', '1.2.0', '1.3.0', '2.0.0b1', '2.0.0b3', '2.1.0']}                              | ${'["~2.0.0", loose=False]'}                                       | ${null}
    ${['1.1.0', '1.2.0', '1.3.0', '2.0.0b1', '2.0.0b3', '2.0.1', '2.1.0']}                     | ${'["~2.0.0", loose=False]'}                                       | ${'2.0.1'}
    ${['1.2.3', '1.2.4', '1.2.5', '1.2.6-pre.1', '2.0.1']}                                     | ${'["~1.2.3", loose=False, include_prerelease=True]'}              | ${'1.2.6-pre.1'}
    ${['1.2.3', '1.2.4', '1.2.5', '1.2.6-pre.1', '2.0.1']}                                     | ${'["~1.2.3", loose=False, include_prerelease=False]'}             | ${'1.2.5'}
    ${['1.2.3', '1.2.4', '1.2.5', '1.2.6-pre.1', '2.0.1']}                                     | ${'["~1.2.3", loose=False, include_prerelease=False]'}             | ${'1.2.5'}
    ${['1.1.1', '1.2.0-pre', '1.2.0', '1.1.1-111', '1.1.1-21']}                                | ${'[<=1.2]'}                                                       | ${'1.2.0'}
    ${['1.1.1', '1.2.0-pre', '1.2', '1.1.1-111', '1.1.1-21']}                                  | ${'[<=1.2]'}                                                       | ${'1.2'}
    ${['1.1.1', '1.2.0-pre', '1.2.0', '1.1.1-111', '1.1.1-21']}                                | ${'[<=1.2.0]'}                                                     | ${'1.2.0'}
    ${['1.1.1', '1.2.0-pre', '1.2', '1.1.1-111', '1.1.1-21']}                                  | ${'[<=1.2.0]'}                                                     | ${'1.2'}
    ${['1.1.0', '1.2.0', '1.2.1', '1.3.0', '2.0.0b1', '2.0.0b2', '2.0.0b3', '2.0.0', '2.1.0']} | ${'["~2.0.0", loose=True, include_prerelease=False]'}              | ${'2.0.0'}
    ${['1.1.0', '1.2.0', '1.2.1', '1.3.0', '2.0.0b1', '2.0.0b2', '2.0.0b3', '2.0.0', '2.1.0']} | ${'["~2.0.0", loose=False, include_prerelease=False]'}             | ${'2.0.0'}
    ${['1.1.0', '1.2.0', '1.2.1', '1.3.0', '2.0.0b1', '2.0.0b2', '2.0.0', '2.0.1b1', '2.1.0']} | ${'["~2.0.0", loose=True, include_prerelease=False]'}              | ${'2.0.0'}
    ${['1.1.0', '1.2.0', '1.2.1', '1.3.0', '2.0.0b1', '2.0.0b2', '2.0.0', '2.0.1b1', '2.1.0']} | ${'["~2.0.0", loose=True, include_prerelease=True]'}               | ${'2.0.1b1'}
  `(
    'getSatisfyingVersion("$versions", "$range") === "$result"',
    ({ versions, range, result }) => {
      const res = conan.getSatisfyingVersion(versions, range);
      expect(res).toEqual(result);
    },
  );

  // minSatisfyingVersion(versions: string[], range: string): string | null;
  it.each`
    versions                                                                                   | range                                                  | result
    ${['1.2.3', '1.2.4', '1.2.5', '1.2.6', '2.0.1']}                                           | ${'["~1.2.3", loose=False]'}                           | ${'1.2.3'}
    ${['1.1.0', '1.2.0', '1.3.0', '2.0.0b1', '2.0.0b3', '2.0.0', '2.1.0']}                     | ${'[~2.0.0]'}                                          | ${'2.0.0'}
    ${['1.1.0', '1.2.0', '1.3.0', '2.0.0b1', '2.0.0b3', '2.1.0']}                              | ${'["~2.0.0", loose=False]'}                           | ${null}
    ${['1.1.0', '1.2.0', '1.3.0', '2.0.0b1', '2.0.0b3', '2.0.1', '2.1.0']}                     | ${'["~2.0.0", loose=False]'}                           | ${'2.0.1'}
    ${['1.2.3-pre.1', '1.2.4', '1.2.5', '1.2.6-pre.1', '2.0.1']}                               | ${'["~1.2.3", loose=False, include_prerelease=True]'}  | ${'1.2.3-pre.1'}
    ${['1.2.3-pre.1', '1.2.4', '1.2.5', '1.2.6-pre.1', '2.0.1']}                               | ${'["~1.2.3", loose=False, include_prerelease=False]'} | ${'1.2.4'}
    ${['1.2.3', '1.2.4']}                                                                      | ${'["1.2", loose=False]'}                              | ${'1.2.3'}
    ${['1.2.4', '1.2.3']}                                                                      | ${'["1.2", loose=False]'}                              | ${'1.2.3'}
    ${['1.2.3', '1.2.4', '1.2.5', '1.2.6']}                                                    | ${'[~1.2.3, loose=False]'}                             | ${'1.2.3'}
    ${['1.1.0', '1.2.0', '1.2.1', '1.3.0', '2.0.0b1', '2.0.0b2', '2.0.0b3', '2.0.0', '2.1.0']} | ${'[~2.0.0, loose=True]'}                              | ${'2.0.0'}
  `(
    'minSatisfyingVersion("$versions", "$range") === "$result"',
    ({ versions, range, result }) => {
      const res = conan.minSatisfyingVersion(versions, range);
      expect(res).toEqual(result);
    },
  );

  // test 4-digit
  it.each`
    version                | major   | minor   | patch
    ${'4.1.3'}             | ${4}    | ${1}    | ${3}
    ${'4.1.3+jenkins'}     | ${4}    | ${1}    | ${3}
    ${'4.1.3-pre'}         | ${4}    | ${1}    | ${3}
    ${'4.1.3.2'}           | ${4}    | ${1}    | ${3}
    ${'4.1.3.2+jenkins'}   | ${4}    | ${1}    | ${3}
    ${'4.1.3.2-pre'}       | ${4}    | ${1}    | ${3}
    ${'4.1.3.2-pre2'}      | ${4}    | ${1}    | ${3}
    ${'4.1.3.2-pre.2'}     | ${4}    | ${1}    | ${3}
    ${'4.1.3.2-pre.2+xxx'} | ${4}    | ${1}    | ${3}
    ${'4.1.33.2'}          | ${4}    | ${1}    | ${33}
    ${'1.a.2'}             | ${null} | ${null} | ${null}
  `(
    'getMajor("$version") === $major getMinor("$version") === $minor getPatch("$version") === $patch',
    ({ version, major, minor, patch }) => {
      expect(conan.getMajor(version)).toBe(major);
      expect(conan.getMinor(version)).toBe(minor);
      expect(conan.getPatch(version)).toBe(patch);
    },
  );

  // getMajor(version: string): null | number;
  it.each`
    version       | result
    ${'4.1.33.2'} | ${4}
  `('getMajor("$version") === "$result"', ({ version, result }) => {
    const res = conan.getMajor(version);
    expect(res).toEqual(result);
  });

  // getMinor(version: string): null | number;
  it.each`
    version       | result
    ${'1.2.3'}    | ${2}
    ${'5.2.1'}    | ${2}
    ${'4.1.33.2'} | ${1}
  `('getMinor("$version") === "$result"', ({ version, result }) => {
    const res = conan.getMinor(version);
    expect(res).toEqual(result);
  });

  // getPatch(version: string): null | number;
  it.each`
    version       | result
    ${'1.2.3'}    | ${3}
    ${'5.2.1'}    | ${1}
    ${'4.1.33.2'} | ${33}
  `('getPatch("$version") === "$result"', ({ version, result }) => {
    const res = conan.getPatch(version);
    expect(res).toEqual(result);
  });

  // equals(version: string, other: string): boolean;
  it.each`
    version               | other                                     | result
    ${'1.2.3'}            | ${'1.2.3'}                                | ${true}
    ${'2.3.1'}            | ${'1.2.3'}                                | ${false}
    ${'1.2.3'}            | ${'v1.2.3, loose=True'}                   | ${true}
    ${'1.2.3'}            | ${'=1.2.3, loose=True'}                   | ${true}
    ${'1.2.3'}            | ${'v 1.2.3, loose=True'}                  | ${true}
    ${'1.2.3'}            | ${'= 1.2.3, loose=True'}                  | ${true}
    ${'1.2.3'}            | ${' v1.2.3, loose=True'}                  | ${true}
    ${'1.2.3'}            | ${' =1.2.3, loose=True'}                  | ${true}
    ${'1.2.3'}            | ${' v 1.2.3, loose=True'}                 | ${true}
    ${'1.2.3'}            | ${' = 1.2.3, loose=True'}                 | ${true}
    ${'1.2.3-0'}          | ${'v1.2.3-0, loose=True'}                 | ${true}
    ${'1.2.3-0'}          | ${'=1.2.3-0, loose=True'}                 | ${true}
    ${'1.2.3-0'}          | ${'v 1.2.3-0, loose=True'}                | ${true}
    ${'1.2.3-0'}          | ${'= 1.2.3-0, loose=True'}                | ${true}
    ${'1.2.3-0'}          | ${' v1.2.3-0, loose=True'}                | ${true}
    ${'1.2.3-0'}          | ${' =1.2.3-0, loose=True'}                | ${true}
    ${'1.2.3-0'}          | ${' v 1.2.3-0, loose=True'}               | ${true}
    ${'1.2.3-0'}          | ${' = 1.2.3-0, loose=True'}               | ${true}
    ${'1.2.3-1'}          | ${'v1.2.3-1, loose=True'}                 | ${true}
    ${'1.2.3-1'}          | ${'=1.2.3-1, loose=True'}                 | ${true}
    ${'1.2.3-1'}          | ${'v 1.2.3-1, loose=True'}                | ${true}
    ${'1.2.3-1'}          | ${'= 1.2.3-1, loose=True'}                | ${true}
    ${'1.2.3-1'}          | ${' v1.2.3-1, loose=True'}                | ${true}
    ${'1.2.3-1'}          | ${' =1.2.3-1, loose=True'}                | ${true}
    ${'1.2.3-1'}          | ${' v 1.2.3-1, loose=True'}               | ${true}
    ${'1.2.3-1'}          | ${' = 1.2.3-1, loose=True'}               | ${true}
    ${'1.2.3-beta'}       | ${'v1.2.3-beta, loose=True'}              | ${true}
    ${'1.2.3-beta'}       | ${'=1.2.3-beta, loose=True'}              | ${true}
    ${'1.2.3-beta'}       | ${'v 1.2.3-beta, loose=True'}             | ${true}
    ${'1.2.3-beta'}       | ${'= 1.2.3-beta, loose=True'}             | ${true}
    ${'1.2.3-beta'}       | ${' v1.2.3-beta, loose=True'}             | ${true}
    ${'1.2.3-beta'}       | ${' =1.2.3-beta, loose=True'}             | ${true}
    ${'1.2.3-beta'}       | ${' v 1.2.3-beta, loose=True'}            | ${true}
    ${'1.2.3-beta'}       | ${' = 1.2.3-beta, loose=True'}            | ${true}
    ${'1.2.3-beta+build'} | ${' = 1.2.3-beta+otherbuild, loose=True'} | ${true}
    ${'1.2.3+build'}      | ${' = 1.2.3+otherbuild, loose=True'}      | ${true}
    ${'1.2.3-beta+build'} | ${'1.2.3-beta+otherbuild, loose=False'}   | ${true}
    ${'1.2.3+build'}      | ${'1.2.3+otherbuild, loose=False'}        | ${true}
    ${'  v1.2.3+build'}   | ${'1.2.3+otherbuild, loose=False'}        | ${true}
    ${'1.3'}              | ${'1.2'}                                  | ${false}
  `(
    'equals("$version", "$other) === "$result"',
    ({ version, other, result }) => {
      const res = conan.equals(version, other);
      expect(res).toEqual(result);
    },
  );

  // isGreaterThan(version: string, other: string): boolean;
  it.each`
    version                              | other                                 | result
    ${'1.2.3'}                           | ${'1.2.3'}                            | ${false}
    ${'19.00'}                           | ${'16.00'}                            | ${true}
    ${'1.2'}                             | ${'1.0'}                              | ${true}
    ${'2.3.1'}                           | ${'1.2.3'}                            | ${true}
    ${'0.0.0, loose=False'}              | ${'0.0.0-foo, loose=False'}           | ${true}
    ${'0.0.1, loose=False'}              | ${'0.0.0, loose=False'}               | ${true}
    ${'1.0.0, loose=False'}              | ${'0.9.9, loose=False'}               | ${true}
    ${'0.10.0, loose=False'}             | ${'0.9.0, loose=False'}               | ${true}
    ${'0.99.0, loose=False'}             | ${'0.10.0, loose=False'}              | ${true}
    ${'2.0.0, loose=False'}              | ${'1.2.3, loose=False'}               | ${true}
    ${'v0.0.0'}                          | ${'0.0.0-foo'}                        | ${true}
    ${'v0.0.1'}                          | ${'0.0.0'}                            | ${true}
    ${'v1.0.0'}                          | ${'0.9.9'}                            | ${true}
    ${'v0.10.0'}                         | ${'0.9.0'}                            | ${true}
    ${'v0.99.0'}                         | ${'0.10.0'}                           | ${true}
    ${'v2.0.0'}                          | ${'1.2.3'}                            | ${true}
    ${'0.0.0, loose=False'}              | ${'v0.0.0-foo, loose=False'}          | ${true}
    ${'0.0.1, loose=False'}              | ${'v0.0.0, loose=False'}              | ${true}
    ${'1.0.0, loose=False'}              | ${'v0.9.9, loose=False'}              | ${true}
    ${'0.10.0, loose=False'}             | ${'v0.9.0, loose=False'}              | ${true}
    ${'0.99.0, loose=False'}             | ${'v0.10.0, loose=False'}             | ${true}
    ${'2.0.0, loose=False'}              | ${'v1.2.3, loose=False'}              | ${true}
    ${'1.2.3, loose=False'}              | ${'1.2.3-asdf, loose=False'}          | ${true}
    ${'1.2.3, loose=False'}              | ${'1.2.3-4, loose=False'}             | ${true}
    ${'1.2.3, loose=False'}              | ${'1.2.3-4-foo, loose=False'}         | ${true}
    ${'1.2.3-5-foo, loose=False'}        | ${'1.2.3-5, loose=False'}             | ${true}
    ${'1.2.3-5, loose=False'}            | ${'1.2.3-4, loose=False'}             | ${true}
    ${'1.2.3-5-foo, loose=False'}        | ${'1.2.3-5-Foo, loose=False'}         | ${true}
    ${'3.0.0, loose=False'}              | ${'2.7.2+asdf, loose=False'}          | ${true}
    ${'1.2.3-a.10, loose=False'}         | ${'1.2.3-a.5, loose=False'}           | ${true}
    ${'1.2.3-a.b, loose=False'}          | ${'1.2.3-a.5, loose=False'}           | ${true}
    ${'1.2.3-a.b, loose=False'}          | ${'1.2.3-a, loose=False'}             | ${true}
    ${'1.2.3-a.b.c.10.d.5, loose=False'} | ${'1.2.3-a.b.c.5.d.100, loose=False'} | ${true}
    ${'1.2.3-r2, loose=False'}           | ${'1.2.3-r100, loose=False'}          | ${true}
    ${'1.2.3-r100, loose=False'}         | ${'1.2.3-R2, loose=False'}            | ${true}
  `(
    'isGreaterThan("$version", "$other) === "$result"',
    ({ version, other, result }) => {
      const res = conan.isGreaterThan(version, other);
      expect(res).toEqual(result);
    },
  );

  // sortVersions(version: string, other: string): boolean;
  it.each`
    version    | other      | result
    ${'1.2'}   | ${'1.3'}   | ${-1}
    ${'1.2.3'} | ${'1.2.3'} | ${0}
    ${'2.3.1'} | ${'1.2.3'} | ${1}
    ${'1.2.3'} | ${'2.3.1'} | ${-1}
  `(
    'sortVersions("$version", "$other) === "$result"',
    ({ version, other, result }) => {
      const res = conan.sortVersions(version, other);
      expect(res).toEqual(result);
    },
  );

  // isLessThanRange(version: string, range: string): boolean;
  it.each`
    version    | range         | result
    ${'1.2.3'} | ${'[>1.2.3]'} | ${true}
    ${'2.3.1'} | ${'[>1.2.3]'} | ${false}
    ${'1.2.3'} | ${'[>2.3.1]'} | ${true}
  `(
    'isLessThanRange("$version", "$range") === "$result"',
    ({ version, range, result }) => {
      const res = conan.isLessThanRange?.(version, range);
      expect(res).toEqual(result);
    },
  );
});
