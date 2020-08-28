import { api as ubuntu } from '.';

describe('versioning/ubuntu', () => {
  // validation

  it('isCompatible', () => {
    expect(ubuntu.isCompatible(undefined)).toBe(false);
    expect(ubuntu.isCompatible(null)).toBe(false);
    expect(ubuntu.isCompatible('')).toBe(false);

    expect(ubuntu.isCompatible('foobar')).toBe(false);
    expect(ubuntu.isCompatible('warty')).toBe(true);
    expect(ubuntu.isCompatible('WaRtY')).toBe(true);
    expect(ubuntu.isCompatible('hoary')).toBe(true);
    expect(ubuntu.isCompatible('breezy')).toBe(true);
    expect(ubuntu.isCompatible('dapper')).toBe(true);
    expect(ubuntu.isCompatible('edgy')).toBe(true);
    expect(ubuntu.isCompatible('feisty')).toBe(true);
    expect(ubuntu.isCompatible('gutsy')).toBe(true);
    expect(ubuntu.isCompatible('hardy')).toBe(true);
    expect(ubuntu.isCompatible('intrepid')).toBe(true);
    expect(ubuntu.isCompatible('jaunty')).toBe(true);
    expect(ubuntu.isCompatible('karmic')).toBe(true);
    expect(ubuntu.isCompatible('lucid')).toBe(true);
    expect(ubuntu.isCompatible('maverick')).toBe(true);
    expect(ubuntu.isCompatible('natty')).toBe(true);
    expect(ubuntu.isCompatible('oneiric')).toBe(true);
    expect(ubuntu.isCompatible('precise')).toBe(true);
    expect(ubuntu.isCompatible('quantal')).toBe(true);
    expect(ubuntu.isCompatible('raring')).toBe(true);
    expect(ubuntu.isCompatible('saucy')).toBe(true);
    expect(ubuntu.isCompatible('trusty')).toBe(true);
    expect(ubuntu.isCompatible('utopic')).toBe(true);
    expect(ubuntu.isCompatible('vivid')).toBe(true);
    expect(ubuntu.isCompatible('wily')).toBe(true);
    expect(ubuntu.isCompatible('xenial')).toBe(true);
    expect(ubuntu.isCompatible('yakkety')).toBe(true);
    expect(ubuntu.isCompatible('zesty')).toBe(true);
    expect(ubuntu.isCompatible('artful')).toBe(true);
    expect(ubuntu.isCompatible('bionic')).toBe(true);
    expect(ubuntu.isCompatible('cosmic')).toBe(true);
    expect(ubuntu.isCompatible('disco')).toBe(true);
    expect(ubuntu.isCompatible('eoan')).toBe(true);
    expect(ubuntu.isCompatible('focal')).toBe(true);
    expect(ubuntu.isCompatible('groovy')).toBe(true);

    expect(ubuntu.isCompatible('04.10')).toBe(true);
    expect(ubuntu.isCompatible('05.04')).toBe(true);
    expect(ubuntu.isCompatible('05.10')).toBe(true);
    expect(ubuntu.isCompatible('6.06')).toBe(true);
    expect(ubuntu.isCompatible('6.10')).toBe(true);
    expect(ubuntu.isCompatible('7.04')).toBe(true);
    expect(ubuntu.isCompatible('7.10')).toBe(true);
    expect(ubuntu.isCompatible('8.04')).toBe(true);
    expect(ubuntu.isCompatible('8.10')).toBe(true);
    expect(ubuntu.isCompatible('9.04')).toBe(true);
    expect(ubuntu.isCompatible('9.10')).toBe(true);
    expect(ubuntu.isCompatible('10.04.4')).toBe(true);
    expect(ubuntu.isCompatible('10.10')).toBe(true);
    expect(ubuntu.isCompatible('11.04')).toBe(true);
    expect(ubuntu.isCompatible('11.10')).toBe(true);
    expect(ubuntu.isCompatible('12.04.5')).toBe(true);
    expect(ubuntu.isCompatible('12.10')).toBe(true);
    expect(ubuntu.isCompatible('13.04')).toBe(true);
    expect(ubuntu.isCompatible('13.10')).toBe(true);
    expect(ubuntu.isCompatible('14.04.6')).toBe(true);
    expect(ubuntu.isCompatible('14.10')).toBe(true);
    expect(ubuntu.isCompatible('15.04')).toBe(true);
    expect(ubuntu.isCompatible('15.10')).toBe(true);
    expect(ubuntu.isCompatible('16.04.7')).toBe(true);
    expect(ubuntu.isCompatible('16.10')).toBe(true);
    expect(ubuntu.isCompatible('17.04')).toBe(true);
    expect(ubuntu.isCompatible('17.10')).toBe(true);
    expect(ubuntu.isCompatible('18.04.5')).toBe(true);
    expect(ubuntu.isCompatible('18.10')).toBe(true);
    expect(ubuntu.isCompatible('19.04')).toBe(true);
    expect(ubuntu.isCompatible('19.10')).toBe(true);
    expect(ubuntu.isCompatible('20.04')).toBe(true);
    expect(ubuntu.isCompatible('20.10')).toBe(true);
    expect(ubuntu.isCompatible('2020.04')).toBe(false);

    expect(ubuntu.isCompatible('20.04', '2020.04')).toBeNull();

    expect(ubuntu.isCompatible('focal', '20.04')).toBe(true);
    expect(ubuntu.isCompatible('20.04', 'focal')).toBe(true);

    expect(ubuntu.isCompatible('focal', '19.10')).toBe(false);
    expect(ubuntu.isCompatible('19.10', 'focal')).toBe(false);
  });

  it('isSingleVersion', () => {
    expect(ubuntu.isSingleVersion('20.04')).toBe(true);
    expect(ubuntu.isSingleVersion('>=20.04')).toBeNull();
  });

  it('isStable', () => {
    expect(ubuntu.isStable(undefined)).toBe(false);
    expect(ubuntu.isStable(null)).toBe(false);
    expect(ubuntu.isStable('')).toBe(false);

    expect(ubuntu.isStable('foobar')).toBe(false);
    expect(ubuntu.isStable('warty')).toBe(false);
    expect(ubuntu.isStable('WaRtY')).toBe(false);
    expect(ubuntu.isStable('hoary')).toBe(false);
    expect(ubuntu.isStable('breezy')).toBe(false);
    expect(ubuntu.isStable('dapper')).toBe(true); // LTS
    expect(ubuntu.isStable('edgy')).toBe(false);
    expect(ubuntu.isStable('feisty')).toBe(false);
    expect(ubuntu.isStable('gutsy')).toBe(false);
    expect(ubuntu.isStable('hardy')).toBe(true); // LTS
    expect(ubuntu.isStable('intrepid')).toBe(false);
    expect(ubuntu.isStable('jaunty')).toBe(false);
    expect(ubuntu.isStable('karmic')).toBe(false);
    expect(ubuntu.isStable('lucid')).toBe(true); // LTS
    expect(ubuntu.isStable('maverick')).toBe(false);
    expect(ubuntu.isStable('natty')).toBe(false);
    expect(ubuntu.isStable('oneiric')).toBe(false);
    expect(ubuntu.isStable('precise')).toBe(true); // LTS
    expect(ubuntu.isStable('quantal')).toBe(false);
    expect(ubuntu.isStable('raring')).toBe(false);
    expect(ubuntu.isStable('saucy')).toBe(false);
    expect(ubuntu.isStable('trusty')).toBe(true); // LTS
    expect(ubuntu.isStable('utopic')).toBe(false);
    expect(ubuntu.isStable('vivid')).toBe(false);
    expect(ubuntu.isStable('wily')).toBe(false);
    expect(ubuntu.isStable('xenial')).toBe(true); // LTS
    expect(ubuntu.isStable('yakkety')).toBe(false);
    expect(ubuntu.isStable('zesty')).toBe(false);
    expect(ubuntu.isStable('artful')).toBe(false);
    expect(ubuntu.isStable('bionic')).toBe(true); // LTS
    expect(ubuntu.isStable('cosmic')).toBe(false);
    expect(ubuntu.isStable('disco')).toBe(false);
    expect(ubuntu.isStable('eoan')).toBe(false);
    expect(ubuntu.isStable('focal')).toBe(true); // LTS
    expect(ubuntu.isStable('groovy')).toBe(false);

    expect(ubuntu.isStable('04.10')).toBe(false);
    expect(ubuntu.isStable('05.04')).toBe(false);
    expect(ubuntu.isStable('05.10')).toBe(false);
    expect(ubuntu.isStable('6.06')).toBe(true); // LTS
    expect(ubuntu.isStable('6.10')).toBe(false);
    expect(ubuntu.isStable('7.04')).toBe(false);
    expect(ubuntu.isStable('7.10')).toBe(false);
    expect(ubuntu.isStable('8.04')).toBe(true); // LTS
    expect(ubuntu.isStable('8.10')).toBe(false);
    expect(ubuntu.isStable('9.04')).toBe(false);
    expect(ubuntu.isStable('9.10')).toBe(false);
    expect(ubuntu.isStable('10.04.4')).toBe(true); // LTS
    expect(ubuntu.isStable('10.10')).toBe(false);
    expect(ubuntu.isStable('11.04')).toBe(false);
    expect(ubuntu.isStable('11.10')).toBe(false);
    expect(ubuntu.isStable('12.04.5')).toBe(true); // LTS
    expect(ubuntu.isStable('12.10')).toBe(false);
    expect(ubuntu.isStable('13.04')).toBe(false);
    expect(ubuntu.isStable('13.10')).toBe(false);
    expect(ubuntu.isStable('14.04.6')).toBe(true); // LTS
    expect(ubuntu.isStable('14.10')).toBe(false);
    expect(ubuntu.isStable('15.04')).toBe(false);
    expect(ubuntu.isStable('15.10')).toBe(false);
    expect(ubuntu.isStable('16.04.7')).toBe(true); // LTS
    expect(ubuntu.isStable('16.10')).toBe(false);
    expect(ubuntu.isStable('17.04')).toBe(false);
    expect(ubuntu.isStable('17.10')).toBe(false);
    expect(ubuntu.isStable('18.04.5')).toBe(true); // LTS
    expect(ubuntu.isStable('18.10')).toBe(false);
    expect(ubuntu.isStable('19.04')).toBe(false);
    expect(ubuntu.isStable('19.10')).toBe(false);
    expect(ubuntu.isStable('20.04')).toBe(true); // LTS
    expect(ubuntu.isStable('20.10')).toBe(false);
    expect(ubuntu.isStable('2020.04')).toBe(false);
  });

  it('isValid', () => {
    expect(ubuntu.isValid(undefined)).toBe(false);
    expect(ubuntu.isValid(null)).toBe(false);
    expect(ubuntu.isValid('')).toBe(false);

    expect(ubuntu.isValid('foobar')).toBe(false);
    expect(ubuntu.isValid('warty')).toBe(true);
    expect(ubuntu.isValid('WaRtY')).toBe(true);
    expect(ubuntu.isValid('hoary')).toBe(true);
    expect(ubuntu.isValid('breezy')).toBe(true);
    expect(ubuntu.isValid('dapper')).toBe(true);
    expect(ubuntu.isValid('edgy')).toBe(true);
    expect(ubuntu.isValid('feisty')).toBe(true);
    expect(ubuntu.isValid('gutsy')).toBe(true);
    expect(ubuntu.isValid('hardy')).toBe(true);
    expect(ubuntu.isValid('intrepid')).toBe(true);
    expect(ubuntu.isValid('jaunty')).toBe(true);
    expect(ubuntu.isValid('karmic')).toBe(true);
    expect(ubuntu.isValid('lucid')).toBe(true);
    expect(ubuntu.isValid('maverick')).toBe(true);
    expect(ubuntu.isValid('natty')).toBe(true);
    expect(ubuntu.isValid('oneiric')).toBe(true);
    expect(ubuntu.isValid('precise')).toBe(true);
    expect(ubuntu.isValid('quantal')).toBe(true);
    expect(ubuntu.isValid('raring')).toBe(true);
    expect(ubuntu.isValid('saucy')).toBe(true);
    expect(ubuntu.isValid('trusty')).toBe(true);
    expect(ubuntu.isValid('utopic')).toBe(true);
    expect(ubuntu.isValid('vivid')).toBe(true);
    expect(ubuntu.isValid('wily')).toBe(true);
    expect(ubuntu.isValid('xenial')).toBe(true);
    expect(ubuntu.isValid('yakkety')).toBe(true);
    expect(ubuntu.isValid('zesty')).toBe(true);
    expect(ubuntu.isValid('artful')).toBe(true);
    expect(ubuntu.isValid('bionic')).toBe(true);
    expect(ubuntu.isValid('cosmic')).toBe(true);
    expect(ubuntu.isValid('disco')).toBe(true);
    expect(ubuntu.isValid('eoan')).toBe(true);
    expect(ubuntu.isValid('focal')).toBe(true);
    expect(ubuntu.isValid('groovy')).toBe(true);

    expect(ubuntu.isValid('04.10')).toBe(true);
    expect(ubuntu.isValid('05.04')).toBe(true);
    expect(ubuntu.isValid('05.10')).toBe(true);
    expect(ubuntu.isValid('6.06')).toBe(true);
    expect(ubuntu.isValid('6.10')).toBe(true);
    expect(ubuntu.isValid('7.04')).toBe(true);
    expect(ubuntu.isValid('7.10')).toBe(true);
    expect(ubuntu.isValid('8.04')).toBe(true);
    expect(ubuntu.isValid('8.10')).toBe(true);
    expect(ubuntu.isValid('9.04')).toBe(true);
    expect(ubuntu.isValid('9.10')).toBe(true);
    expect(ubuntu.isValid('10.04.4')).toBe(true);
    expect(ubuntu.isValid('10.10')).toBe(true);
    expect(ubuntu.isValid('11.04')).toBe(true);
    expect(ubuntu.isValid('11.10')).toBe(true);
    expect(ubuntu.isValid('12.04.5')).toBe(true);
    expect(ubuntu.isValid('12.10')).toBe(true);
    expect(ubuntu.isValid('13.04')).toBe(true);
    expect(ubuntu.isValid('13.10')).toBe(true);
    expect(ubuntu.isValid('14.04.6')).toBe(true);
    expect(ubuntu.isValid('14.10')).toBe(true);
    expect(ubuntu.isValid('15.04')).toBe(true);
    expect(ubuntu.isValid('15.10')).toBe(true);
    expect(ubuntu.isValid('16.04.7')).toBe(true);
    expect(ubuntu.isValid('16.10')).toBe(true);
    expect(ubuntu.isValid('17.04')).toBe(true);
    expect(ubuntu.isValid('17.10')).toBe(true);
    expect(ubuntu.isValid('18.04.5')).toBe(true);
    expect(ubuntu.isValid('18.10')).toBe(true);
    expect(ubuntu.isValid('19.04')).toBe(true);
    expect(ubuntu.isValid('19.10')).toBe(true);
    expect(ubuntu.isValid('20.04')).toBe(true);
    expect(ubuntu.isValid('20.10')).toBe(true);
    expect(ubuntu.isValid('2020.04')).toBe(false);
  });

  it('isVersion', () => {
    expect(ubuntu.isVersion(undefined)).toBe(false);
    expect(ubuntu.isVersion(null)).toBe(false);
    expect(ubuntu.isVersion('')).toBe(false);

    expect(ubuntu.isVersion('foobar')).toBe(false);
    expect(ubuntu.isVersion('warty')).toBe(true);
    expect(ubuntu.isVersion('WaRtY')).toBe(true);
    expect(ubuntu.isVersion('hoary')).toBe(true);
    expect(ubuntu.isVersion('breezy')).toBe(true);
    expect(ubuntu.isVersion('dapper')).toBe(true);
    expect(ubuntu.isVersion('edgy')).toBe(true);
    expect(ubuntu.isVersion('feisty')).toBe(true);
    expect(ubuntu.isVersion('gutsy')).toBe(true);
    expect(ubuntu.isVersion('hardy')).toBe(true);
    expect(ubuntu.isVersion('intrepid')).toBe(true);
    expect(ubuntu.isVersion('jaunty')).toBe(true);
    expect(ubuntu.isVersion('karmic')).toBe(true);
    expect(ubuntu.isVersion('lucid')).toBe(true);
    expect(ubuntu.isVersion('maverick')).toBe(true);
    expect(ubuntu.isVersion('natty')).toBe(true);
    expect(ubuntu.isVersion('oneiric')).toBe(true);
    expect(ubuntu.isVersion('precise')).toBe(true);
    expect(ubuntu.isVersion('quantal')).toBe(true);
    expect(ubuntu.isVersion('raring')).toBe(true);
    expect(ubuntu.isVersion('saucy')).toBe(true);
    expect(ubuntu.isVersion('trusty')).toBe(true);
    expect(ubuntu.isVersion('utopic')).toBe(true);
    expect(ubuntu.isVersion('vivid')).toBe(true);
    expect(ubuntu.isVersion('wily')).toBe(true);
    expect(ubuntu.isVersion('xenial')).toBe(true);
    expect(ubuntu.isVersion('yakkety')).toBe(true);
    expect(ubuntu.isVersion('zesty')).toBe(true);
    expect(ubuntu.isVersion('artful')).toBe(true);
    expect(ubuntu.isVersion('bionic')).toBe(true);
    expect(ubuntu.isVersion('cosmic')).toBe(true);
    expect(ubuntu.isVersion('disco')).toBe(true);
    expect(ubuntu.isVersion('eoan')).toBe(true);
    expect(ubuntu.isVersion('focal')).toBe(true);
    expect(ubuntu.isVersion('groovy')).toBe(true);

    expect(ubuntu.isVersion('04.10')).toBe(true);
    expect(ubuntu.isVersion('05.04')).toBe(true);
    expect(ubuntu.isVersion('05.10')).toBe(true);
    expect(ubuntu.isVersion('6.06')).toBe(true);
    expect(ubuntu.isVersion('6.10')).toBe(true);
    expect(ubuntu.isVersion('7.04')).toBe(true);
    expect(ubuntu.isVersion('7.10')).toBe(true);
    expect(ubuntu.isVersion('8.04')).toBe(true);
    expect(ubuntu.isVersion('8.10')).toBe(true);
    expect(ubuntu.isVersion('9.04')).toBe(true);
    expect(ubuntu.isVersion('9.10')).toBe(true);
    expect(ubuntu.isVersion('10.04.4')).toBe(true);
    expect(ubuntu.isVersion('10.10')).toBe(true);
    expect(ubuntu.isVersion('11.04')).toBe(true);
    expect(ubuntu.isVersion('11.10')).toBe(true);
    expect(ubuntu.isVersion('12.04.5')).toBe(true);
    expect(ubuntu.isVersion('12.10')).toBe(true);
    expect(ubuntu.isVersion('13.04')).toBe(true);
    expect(ubuntu.isVersion('13.10')).toBe(true);
    expect(ubuntu.isVersion('14.04.6')).toBe(true);
    expect(ubuntu.isVersion('14.10')).toBe(true);
    expect(ubuntu.isVersion('15.04')).toBe(true);
    expect(ubuntu.isVersion('15.10')).toBe(true);
    expect(ubuntu.isVersion('16.04.7')).toBe(true);
    expect(ubuntu.isVersion('16.10')).toBe(true);
    expect(ubuntu.isVersion('17.04')).toBe(true);
    expect(ubuntu.isVersion('17.10')).toBe(true);
    expect(ubuntu.isVersion('18.04.5')).toBe(true);
    expect(ubuntu.isVersion('18.10')).toBe(true);
    expect(ubuntu.isVersion('19.04')).toBe(true);
    expect(ubuntu.isVersion('19.10')).toBe(true);
    expect(ubuntu.isVersion('20.04')).toBe(true);
    expect(ubuntu.isVersion('20.10')).toBe(true);
    expect(ubuntu.isVersion('2020.04')).toBe(false);
  });

  // digestion of version

  it('getMajor', () => {
    expect(ubuntu.getMajor(undefined)).toBeNull();
    expect(ubuntu.getMajor(null)).toBeNull();
    expect(ubuntu.getMajor('')).toBeNull();
    expect(ubuntu.getMajor('42')).toBeNull();
    expect(ubuntu.getMajor('2020.04')).toBeNull();

    expect(ubuntu.getMajor('04.10')).toBe(4);
    expect(ubuntu.getMajor('warty')).toBe(4);

    expect(ubuntu.getMajor('18.04.5')).toBe(18);
    expect(ubuntu.getMajor('bionic')).toBe(18);

    expect(ubuntu.getMajor('20.04')).toBe(20);
    expect(ubuntu.getMajor('focal')).toBe(20);
  });

  it('getMinor', () => {
    expect(ubuntu.getMinor(undefined)).toBeNull();
    expect(ubuntu.getMinor(null)).toBeNull();
    expect(ubuntu.getMinor('')).toBeNull();
    expect(ubuntu.getMinor('42')).toBeNull();
    expect(ubuntu.getMinor('2020.04')).toBeNull();

    expect(ubuntu.getMinor('04.10')).toBe(10);
    expect(ubuntu.getMinor('warty')).toBe(10);

    expect(ubuntu.getMinor('18.04.5')).toBe(4);
    expect(ubuntu.getMinor('bionic')).toBe(4);

    expect(ubuntu.getMinor('20.04')).toBe(4);
    expect(ubuntu.getMinor('focal')).toBe(4);
  });

  it('getPatch', () => {
    expect(ubuntu.getPatch(undefined)).toBeNull();
    expect(ubuntu.getPatch(null)).toBeNull();
    expect(ubuntu.getPatch('')).toBeNull();
    expect(ubuntu.getPatch('42')).toBeNull();
    expect(ubuntu.getPatch('2020.04')).toBeNull();

    expect(ubuntu.getPatch('04.10')).toBeNull();
    expect(ubuntu.getPatch('warty')).toBeNull();

    expect(ubuntu.getPatch('18.04.5')).toBe(5);
    expect(ubuntu.getPatch('bionic')).toBe(5);

    expect(ubuntu.getPatch('20.04')).toBeNull();
    expect(ubuntu.getPatch('focal')).toBeNull();
  });

  // comparison

  it('equals', () => {
    expect(ubuntu.equals('20.04', '2020.04')).toBe(false);

    expect(ubuntu.equals('focal', '20.04')).toBe(true);
    expect(ubuntu.equals('20.04', 'focal')).toBe(true);

    expect(ubuntu.equals('focal', '19.10')).toBe(false);
    expect(ubuntu.equals('19.10', 'focal')).toBe(false);
  });

  it('isGreaterThan', () => {
    expect(ubuntu.isGreaterThan('20.04', '2020.04')).toBe(false);

    expect(ubuntu.isGreaterThan('focal', '20.04')).toBe(false);
    expect(ubuntu.isGreaterThan('20.04', 'focal')).toBe(false);

    expect(ubuntu.isGreaterThan('20.04', '19.10')).toBe(true);
    expect(ubuntu.isGreaterThan('focal', '19.10')).toBe(true);
    expect(ubuntu.isGreaterThan('19.10', 'focal')).toBe(false);
    expect(ubuntu.isGreaterThan('eoan', 'focal')).toBe(false);
  });

  it('maxSatisfyingVersion', () => {
    const versions = ['18.10', '19.04', '19.10', '20.04'];

    expect(ubuntu.maxSatisfyingVersion(versions, 'foobar')).toBeNull();
    expect(ubuntu.maxSatisfyingVersion(versions, '2020.04')).toBeNull();

    expect(ubuntu.maxSatisfyingVersion(versions, '20.04')).toBe('20.04');
    expect(ubuntu.maxSatisfyingVersion(versions, 'focal')).toBe('focal');

    expect(ubuntu.maxSatisfyingVersion(versions, '19.10')).toBe('19.10');
    expect(ubuntu.maxSatisfyingVersion(versions, 'eoan')).toBe('eoan');

    expect(ubuntu.maxSatisfyingVersion(versions, '04.10')).toBeNull();
    expect(ubuntu.maxSatisfyingVersion(versions, 'warty')).toBeNull();
  });

  it('minSatisfyingVersion', () => {
    const versions = ['18.10', '19.04', '19.10', '20.04'];

    expect(ubuntu.minSatisfyingVersion(versions, 'foobar')).toBeNull();
    expect(ubuntu.minSatisfyingVersion(versions, '2020.04')).toBeNull();

    expect(ubuntu.minSatisfyingVersion(versions, '20.04')).toBe('20.04');
    expect(ubuntu.minSatisfyingVersion(versions, 'focal')).toBe('focal');

    expect(ubuntu.minSatisfyingVersion(versions, '19.10')).toBe('19.10');
    expect(ubuntu.minSatisfyingVersion(versions, 'eoan')).toBe('eoan');

    expect(ubuntu.minSatisfyingVersion(versions, '04.10')).toBeNull();
    expect(ubuntu.minSatisfyingVersion(versions, 'warty')).toBeNull();
  });

  it('getNewValue simply returns toVersion', () => {
    expect(ubuntu.getNewValue({ toVersion: 'foobar' } as never)).toEqual(
      'foobar'
    );
  });

  it('sortVersions', () => {
    const versions = ['focal', '19.10', 'disco', '18.10'];
    expect(versions.sort(ubuntu.sortVersions)).toEqual(versions.reverse());
  });

  it('matches', () => {
    expect(ubuntu.matches('20.04', '2020.04')).toBe(false);

    expect(ubuntu.matches('focal', '20.04')).toBe(true);
    expect(ubuntu.matches('20.04', 'focal')).toBe(true);

    expect(ubuntu.matches('focal', '19.10')).toBe(false);
    expect(ubuntu.matches('19.10', 'focal')).toBe(false);
  });
});
