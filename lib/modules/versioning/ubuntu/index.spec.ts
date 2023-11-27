import { DateTime, Settings } from 'luxon';
import { api as ubuntu } from '.';

describe('modules/versioning/ubuntu/index', () => {
  const dt = DateTime.fromISO('2022-04-20');

  it.each`
    version             | expected
    ${undefined}        | ${false}
    ${null}             | ${false}
    ${''}               | ${false}
    ${'xenial'}         | ${true}
    ${'04.10'}          | ${true}
    ${'05.04'}          | ${true}
    ${'05.10'}          | ${true}
    ${'6.06'}           | ${true}
    ${'6.10'}           | ${true}
    ${'7.04'}           | ${true}
    ${'7.10'}           | ${true}
    ${'8.04'}           | ${true}
    ${'8.10'}           | ${true}
    ${'9.04'}           | ${true}
    ${'9.10'}           | ${true}
    ${'10.04.4'}        | ${true}
    ${'10.10'}          | ${true}
    ${'11.04'}          | ${true}
    ${'11.10'}          | ${true}
    ${'12.04.5'}        | ${true}
    ${'12.10'}          | ${true}
    ${'13.04'}          | ${true}
    ${'13.10'}          | ${true}
    ${'14.04.6'}        | ${true}
    ${'14.10'}          | ${true}
    ${'15.04'}          | ${true}
    ${'15.10'}          | ${true}
    ${'16.04.7'}        | ${true}
    ${'16.10'}          | ${true}
    ${'17.04'}          | ${true}
    ${'17.10'}          | ${true}
    ${'18.04.5'}        | ${true}
    ${'18.10'}          | ${true}
    ${'19.04'}          | ${true}
    ${'19.10'}          | ${true}
    ${'20.04'}          | ${true}
    ${'20.10'}          | ${true}
    ${'2020.04'}        | ${false}
    ${'xenial'}         | ${true}
    ${'warty'}          | ${true}
    ${'hoary'}          | ${true}
    ${'breezy'}         | ${true}
    ${'dapper'}         | ${true}
    ${'edgy'}           | ${true}
    ${'feisty'}         | ${true}
    ${'gutsy'}          | ${true}
    ${'hardy'}          | ${true}
    ${'intrepid'}       | ${true}
    ${'jaunty'}         | ${true}
    ${'karmic'}         | ${true}
    ${'lucid.4'}        | ${false}
    ${'maverick'}       | ${true}
    ${'natty'}          | ${true}
    ${'oneiric'}        | ${true}
    ${'precise.5'}      | ${false}
    ${'quantal'}        | ${true}
    ${'raring'}         | ${true}
    ${'saucy'}          | ${true}
    ${'trusty.6'}       | ${false}
    ${'utopic'}         | ${true}
    ${'vivid'}          | ${true}
    ${'wily'}           | ${true}
    ${'xenial.7'}       | ${false}
    ${'yakkety'}        | ${true}
    ${'zesty'}          | ${true}
    ${'artful'}         | ${true}
    ${'bionic.5'}       | ${false}
    ${'cosmic'}         | ${true}
    ${'disco'}          | ${true}
    ${'eoan'}           | ${true}
    ${'focal'}          | ${true}
    ${'groovy'}         | ${true}
    ${'hirsute'}        | ${true}
    ${'impish'}         | ${true}
    ${'jammy'}          | ${true}
    ${'jammy-20230816'} | ${true}
    ${'jammy-2023086'}  | ${false}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(ubuntu.isValid(version)).toBe(expected);
  });

  it.each`
    version      | range        | expected
    ${undefined} | ${undefined} | ${false}
    ${null}      | ${undefined} | ${false}
    ${''}        | ${undefined} | ${false}
    ${'04.10'}   | ${undefined} | ${true}
    ${'20.10'}   | ${undefined} | ${true}
    ${'warty'}   | ${undefined} | ${true}
    ${'groovy'}  | ${undefined} | ${true}
  `(
    'isCompatible("$version") === $expected',
    ({ version, range, expected }) => {
      expect(ubuntu.isCompatible(version, range)).toBe(expected);
    },
  );

  it.each`
    version      | expected
    ${undefined} | ${false}
    ${null}      | ${false}
    ${''}        | ${false}
    ${'20.04'}   | ${true}
    ${'>=20.04'} | ${false}
  `('isSingleVersion("$version") === $expected', ({ version, expected }) => {
    expect(ubuntu.isSingleVersion(version)).toBe(expected);
  });

  it.each`
    version       | expected
    ${undefined}  | ${false}
    ${null}       | ${false}
    ${''}         | ${false}
    ${'04.10'}    | ${false}
    ${'05.04'}    | ${false}
    ${'05.10'}    | ${false}
    ${'6.06'}     | ${false}
    ${'6.10'}     | ${false}
    ${'7.04'}     | ${false}
    ${'7.10'}     | ${false}
    ${'8.04'}     | ${true}
    ${'8.10'}     | ${false}
    ${'9.04'}     | ${false}
    ${'9.10'}     | ${false}
    ${'10.04.4'}  | ${true}
    ${'10.10'}    | ${false}
    ${'11.04'}    | ${false}
    ${'11.10'}    | ${false}
    ${'12.04.5'}  | ${true}
    ${'12.10'}    | ${false}
    ${'13.04'}    | ${false}
    ${'13.10'}    | ${false}
    ${'14.04.6'}  | ${true}
    ${'14.10'}    | ${false}
    ${'15.04'}    | ${false}
    ${'15.10'}    | ${false}
    ${'16.04.7'}  | ${true}
    ${'16.10'}    | ${false}
    ${'17.04'}    | ${false}
    ${'17.10'}    | ${false}
    ${'18.04.5'}  | ${true}
    ${'18.10'}    | ${false}
    ${'19.04'}    | ${false}
    ${'19.10'}    | ${false}
    ${'20.04'}    | ${true}
    ${'20.10'}    | ${false}
    ${'22.04'}    | ${false}
    ${'2020.04'}  | ${false}
    ${'warty'}    | ${false}
    ${'hoary'}    | ${false}
    ${'breezy'}   | ${false}
    ${'dapper'}   | ${false}
    ${'edgy'}     | ${false}
    ${'feisty'}   | ${false}
    ${'gutsy'}    | ${false}
    ${'hardy'}    | ${true}
    ${'intrepid'} | ${false}
    ${'jaunty'}   | ${false}
    ${'karmic'}   | ${false}
    ${'lucid'}    | ${true}
    ${'maverick'} | ${false}
    ${'natty'}    | ${false}
    ${'oneiric'}  | ${false}
    ${'precise'}  | ${true}
    ${'quantal'}  | ${false}
    ${'raring'}   | ${false}
    ${'saucy'}    | ${false}
    ${'trusty'}   | ${true}
    ${'utopic'}   | ${false}
    ${'vivid'}    | ${false}
    ${'wily'}     | ${false}
    ${'xenial'}   | ${true}
    ${'yakkety'}  | ${false}
    ${'zesty'}    | ${false}
    ${'artful'}   | ${false}
    ${'bionic'}   | ${true}
    ${'cosmic'}   | ${false}
    ${'disco'}    | ${false}
    ${'eoan'}     | ${false}
    ${'focal'}    | ${true}
    ${'groovy'}   | ${false}
    ${'hirsute'}  | ${false}
    ${'impish'}   | ${false}
    ${'jammy'}    | ${false}
  `('isStable("$version") === $expected', ({ version, expected }) => {
    Settings.now = () => dt.valueOf();
    expect(ubuntu.isStable(version)).toBe(expected);
  });

  it.each`
    version      | expected
    ${undefined} | ${false}
    ${null}      | ${false}
    ${''}        | ${false}
    ${'02.10'}   | ${false}
    ${'04.10'}   | ${true}
    ${'05.04'}   | ${true}
    ${'6.06'}    | ${true}
    ${'8.04'}    | ${true}
    ${'9.04'}    | ${true}
    ${'10.04.4'} | ${true}
    ${'12.04.5'} | ${true}
    ${'13.04'}   | ${true}
    ${'14.04.6'} | ${true}
    ${'15.04'}   | ${true}
    ${'16.04.7'} | ${true}
    ${'16.10'}   | ${true}
    ${'17.04'}   | ${true}
    ${'18.04.5'} | ${true}
    ${'18.10'}   | ${true}
    ${'20.04'}   | ${true}
    ${'20.10'}   | ${true}
    ${'30.11'}   | ${true}
    ${'2020.04'} | ${false}
    ${'warty'}   | ${true}
    ${'hoary'}   | ${true}
    ${'dapper'}  | ${true}
    ${'hardy'}   | ${true}
    ${'jaunty'}  | ${true}
    ${'lucid'}   | ${true}
    ${'precise'} | ${true}
    ${'raring'}  | ${true}
    ${'trusty'}  | ${true}
    ${'vivid'}   | ${true}
    ${'xenial'}  | ${true}
    ${'yakkety'} | ${true}
    ${'zesty'}   | ${true}
    ${'bionic'}  | ${true}
    ${'cosmic'}  | ${true}
    ${'focal'}   | ${true}
    ${'groovy'}  | ${true}
    ${'hirsute'} | ${true}
    ${'impish'}  | ${true}
    ${'jammy'}   | ${true}
    ${'Groovy'}  | ${false}
    ${'Hirsute'} | ${false}
    ${'impish-'} | ${false}
    ${'JAMMY'}   | ${false}
  `('isVersion("$version") === $expected', ({ version, expected }) => {
    expect(ubuntu.isVersion(version)).toBe(expected);
  });

  it.each`
    version             | major   | minor   | patch
    ${undefined}        | ${null} | ${null} | ${null}
    ${null}             | ${null} | ${null} | ${null}
    ${''}               | ${null} | ${null} | ${null}
    ${'42'}             | ${null} | ${null} | ${null}
    ${'2020.04'}        | ${null} | ${null} | ${null}
    ${'04.10'}          | ${4}    | ${10}   | ${null}
    ${'18.04.5'}        | ${18}   | ${4}    | ${5}
    ${'20.04'}          | ${20}   | ${4}    | ${null}
    ${'intrepid'}       | ${8}    | ${10}   | ${null}
    ${'bionic'}         | ${18}   | ${4}    | ${null}
    ${'focal'}          | ${20}   | ${4}    | ${null}
    ${'jammy-20230816'} | ${22}   | ${4}    | ${null}
  `(
    'getMajor, getMinor, getPatch for "$version"',
    ({ version, major, minor, patch }) => {
      expect(ubuntu.getMajor(version)).toBe(major);
      expect(ubuntu.getMinor(version)).toBe(minor);
      expect(ubuntu.getPatch(version)).toBe(patch);
    },
  );

  it.each`
    a                   | b                   | expected
    ${'20.04'}          | ${'2020.04'}        | ${false}
    ${'17.10'}          | ${'artful'}         | ${true}
    ${'xenial'}         | ${'artful'}         | ${false}
    ${'17.04'}          | ${'artful'}         | ${false}
    ${'artful'}         | ${'17.10'}          | ${true}
    ${'16.04'}          | ${'xenial'}         | ${true}
    ${'focal'}          | ${'20.04'}          | ${true}
    ${'20.04'}          | ${'focal'}          | ${true}
    ${'19.10'}          | ${'19.10'}          | ${true}
    ${'jammy'}          | ${'jammy-20230816'} | ${false}
    ${'jammy-20230816'} | ${'jammy-20230816'} | ${true}
    ${'jammy-20230716'} | ${'jammy-20230816'} | ${false}
  `('equals($a, $b) === $expected', ({ a, b, expected }) => {
    expect(ubuntu.equals(a, b)).toBe(expected);
  });

  it.each`
    a                   | b                   | expected
    ${'20.04'}          | ${'20.10'}          | ${false}
    ${'20.10'}          | ${'20.04'}          | ${true}
    ${'19.10'}          | ${'20.04'}          | ${false}
    ${'20.04'}          | ${'19.10'}          | ${true}
    ${'16.04'}          | ${'16.04.7'}        | ${false}
    ${'16.04.7'}        | ${'16.04'}          | ${true}
    ${'16.04.1'}        | ${'16.04.7'}        | ${false}
    ${'16.04.7'}        | ${'16.04.1'}        | ${true}
    ${'19.10.1'}        | ${'20.04.1'}        | ${false}
    ${'20.04.1'}        | ${'19.10.1'}        | ${true}
    ${'xxx'}            | ${'yyy'}            | ${false}
    ${'focal'}          | ${'groovy'}         | ${false}
    ${'groovy'}         | ${'focal'}          | ${true}
    ${'eoan'}           | ${'focal'}          | ${false}
    ${'focal'}          | ${'eoan'}           | ${true}
    ${'vivid'}          | ${'saucy'}          | ${true}
    ${'impish'}         | ${'focal'}          | ${true}
    ${'eoan'}           | ${'quantal'}        | ${true}
    ${'focal'}          | ${'lucid'}          | ${true}
    ${'eoan'}           | ${'focal'}          | ${false}
    ${'focal'}          | ${'eoan'}           | ${true}
    ${'jammy'}          | ${'focal'}          | ${true}
    ${'jammy-20230816'} | ${'focal'}          | ${true}
    ${'jammy-20230816'} | ${'jammy-20230716'} | ${true}
    ${'jammy-20230716'} | ${'jammy-20230816'} | ${false}
    ${'focal-20230816'} | ${'jammy-20230716'} | ${false}
  `('isGreaterThan("$a", "$b") === $expected', ({ a, b, expected }) => {
    expect(ubuntu.isGreaterThan(a, b)).toBe(expected);
  });

  it.each`
    versions                                | range        | expected
    ${['18.10', '19.04', '19.10', '20.04']} | ${'2020.04'} | ${null}
    ${['18.10', '19.04', '19.10', '20.04']} | ${'foobar'}  | ${null}
    ${['18.10', '19.04', '19.10', '20.04']} | ${'20.04'}   | ${'20.04'}
    ${['18.10', '19.04', '19.10', '20.04']} | ${'19.10'}   | ${'19.10'}
    ${['18.10', '19.04', '19.10', '20.04']} | ${'04.10'}   | ${null}
    ${['cosmic', 'disco', 'eoan', 'focal']} | ${'2020.04'} | ${null}
    ${['cosmic', 'disco', 'eoan', 'focal']} | ${'foobar'}  | ${null}
    ${['cosmic', 'disco', 'eoan', 'focal']} | ${'focal'}   | ${'focal'}
    ${['cosmic', 'disco', 'eoan', 'focal']} | ${'eoan'}    | ${'eoan'}
    ${['cosmic', 'disco', 'eoan', 'focal']} | ${'warty'}   | ${null}
  `(
    'getSatisfyingVersion($versions, "$range") === "$expected"',
    ({ versions, range, expected }) => {
      expect(ubuntu.getSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    versions                                | range        | expected
    ${['18.10', '19.04', '19.10', '20.04']} | ${'2020.04'} | ${null}
    ${['18.10', '19.04', '19.10', '20.04']} | ${'foobar'}  | ${null}
    ${['18.10', '19.04', '19.10', '20.04']} | ${'20.04'}   | ${'20.04'}
    ${['18.10', '19.04', '19.10', '20.04']} | ${'19.10'}   | ${'19.10'}
    ${['18.10', '19.04', '19.10', '20.04']} | ${'04.10'}   | ${null}
    ${['cosmic', 'disco', 'eoan', 'focal']} | ${'2020.04'} | ${null}
    ${['cosmic', 'disco', 'eoan', 'focal']} | ${'foobar'}  | ${null}
    ${['cosmic', 'disco', 'eoan', 'focal']} | ${'focal'}   | ${'focal'}
    ${['cosmic', 'disco', 'eoan', 'focal']} | ${'eoan'}    | ${'eoan'}
    ${['cosmic', 'disco', 'eoan', 'focal']} | ${'warty'}   | ${null}
  `(
    'minSatisfyingVersion($versions, "$range") === "$expected"',
    ({ versions, range, expected }) => {
      expect(ubuntu.minSatisfyingVersion(versions, range)).toBe(expected);
    },
  );

  it.each`
    currentValue | rangeStrategy | currentVersion | newVersion  | expected
    ${undefined} | ${undefined}  | ${undefined}   | ${'foobar'} | ${'foobar'}
    ${'xenial'}  | ${undefined}  | ${undefined}   | ${'20.04'}  | ${'focal'}
    ${'xenial'}  | ${undefined}  | ${undefined}   | ${'focal'}  | ${'focal'}
    ${'16.04'}   | ${undefined}  | ${undefined}   | ${'20.04'}  | ${'20.04'}
    ${'16.04'}   | ${undefined}  | ${undefined}   | ${'focal'}  | ${'20.04'}
  `(
    'getNewValue("$currentValue", "$rangeStrategy", "$currentVersion", "$newVersion") === "$expected"',
    ({ currentValue, rangeStrategy, currentVersion, newVersion, expected }) => {
      expect(
        ubuntu.getNewValue({
          currentValue,
          rangeStrategy,
          currentVersion,
          newVersion,
        }),
      ).toBe(expected);
    },
  );

  it.each`
    versions                                                  | expected
    ${['17.03', '18.04', '18.04', '6.10', '19.10']}           | ${['6.10', '17.03', '18.04', '18.04', '19.10']}
    ${['17.03', 'zesty', 'bionic', 'bionic', 'edgy', 'eoan']} | ${['edgy', '17.03', 'zesty', 'bionic', 'bionic', 'eoan']}
  `('$versions -> sortVersions -> $expected ', ({ versions, expected }) => {
    expect(versions.sort(ubuntu.sortVersions)).toEqual(expected);
  });

  it.each`
    version    | range        | expected
    ${'20.04'} | ${'2020.04'} | ${false}
    ${'20.04'} | ${'20.04'}   | ${true}
    ${'20.04'} | ${'20.04.0'} | ${false}
  `(
    'matches("$version", "$range") === "$expected"',
    ({ version, range, expected }) => {
      expect(ubuntu.matches(version, range)).toBe(expected);
    },
  );
});
