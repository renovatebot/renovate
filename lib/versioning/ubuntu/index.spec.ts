import { getName } from '../../../test/util';
import { api as ubuntu } from '.';

describe(getName(__filename), () => {
  // validation

  it('isValid', () => {
    expect(ubuntu.isValid(undefined)).toBe(false);
    expect(ubuntu.isValid(null)).toBe(false);
    expect(ubuntu.isValid('')).toBe(false);
    expect(ubuntu.isValid('xenial')).toBe(false);

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

  it('isCompatible', () => {
    expect(ubuntu.isCompatible(undefined)).toBe(false);
    expect(ubuntu.isCompatible(null)).toBe(false);
    expect(ubuntu.isCompatible('')).toBe(false);

    expect(ubuntu.isCompatible('04.10')).toBe(true);
    expect(ubuntu.isCompatible('20.10')).toBe(true);
  });

  it('isSingleVersion', () => {
    expect(ubuntu.isSingleVersion(undefined)).toBeNull();
    expect(ubuntu.isSingleVersion(null)).toBeNull();
    expect(ubuntu.isSingleVersion('')).toBeNull();
    expect(ubuntu.isSingleVersion('20.04')).toBe(true);
    expect(ubuntu.isSingleVersion('>=20.04')).toBeNull();
  });

  it('isStable', () => {
    expect(ubuntu.isStable(undefined)).toBe(false);
    expect(ubuntu.isStable(null)).toBe(false);
    expect(ubuntu.isStable('')).toBe(false);

    expect(ubuntu.isStable('04.10')).toBe(false);
    expect(ubuntu.isStable('05.04')).toBe(false);
    expect(ubuntu.isStable('05.10')).toBe(false);
    expect(ubuntu.isStable('6.06')).toBe(false); // it's okay
    expect(ubuntu.isStable('6.10')).toBe(false);
    expect(ubuntu.isStable('7.04')).toBe(false);
    expect(ubuntu.isStable('7.10')).toBe(false);
    expect(ubuntu.isStable('8.04')).toBe(true);
    expect(ubuntu.isStable('8.10')).toBe(false);
    expect(ubuntu.isStable('9.04')).toBe(false);
    expect(ubuntu.isStable('9.10')).toBe(false);
    expect(ubuntu.isStable('10.04.4')).toBe(true);
    expect(ubuntu.isStable('10.10')).toBe(false);
    expect(ubuntu.isStable('11.04')).toBe(false);
    expect(ubuntu.isStable('11.10')).toBe(false);
    expect(ubuntu.isStable('12.04.5')).toBe(true);
    expect(ubuntu.isStable('12.10')).toBe(false);
    expect(ubuntu.isStable('13.04')).toBe(false);
    expect(ubuntu.isStable('13.10')).toBe(false);
    expect(ubuntu.isStable('14.04.6')).toBe(true);
    expect(ubuntu.isStable('14.10')).toBe(false);
    expect(ubuntu.isStable('15.04')).toBe(false);
    expect(ubuntu.isStable('15.10')).toBe(false);
    expect(ubuntu.isStable('16.04.7')).toBe(true);
    expect(ubuntu.isStable('16.10')).toBe(false);
    expect(ubuntu.isStable('17.04')).toBe(false);
    expect(ubuntu.isStable('17.10')).toBe(false);
    expect(ubuntu.isStable('18.04.5')).toBe(true);
    expect(ubuntu.isStable('18.10')).toBe(false);
    expect(ubuntu.isStable('19.04')).toBe(false);
    expect(ubuntu.isStable('19.10')).toBe(false);
    expect(ubuntu.isStable('20.04')).toBe(true);
    expect(ubuntu.isStable('20.10')).toBe(false);

    expect(ubuntu.isStable('42.01')).toBe(false);
    expect(ubuntu.isStable('42.02')).toBe(false);
    expect(ubuntu.isStable('42.03')).toBe(false);
    expect(ubuntu.isStable('42.04')).toBe(true);
    expect(ubuntu.isStable('42.05')).toBe(false);
    expect(ubuntu.isStable('42.06')).toBe(false);
    expect(ubuntu.isStable('42.07')).toBe(false);
    expect(ubuntu.isStable('42.08')).toBe(false);
    expect(ubuntu.isStable('42.09')).toBe(false);
    expect(ubuntu.isStable('42.10')).toBe(false);
    expect(ubuntu.isStable('42.11')).toBe(false);

    expect(ubuntu.isStable('2020.04')).toBe(false);
  });

  it('isVersion', () => {
    expect(ubuntu.isVersion(undefined)).toBe(false);
    expect(ubuntu.isVersion(null)).toBe(false);
    expect(ubuntu.isVersion('')).toBe(false);

    expect(ubuntu.isVersion('02.10')).toBe(false);
    expect(ubuntu.isVersion('04.10')).toBe(true);
    expect(ubuntu.isVersion('05.04')).toBe(true);
    expect(ubuntu.isVersion('6.06')).toBe(true);
    expect(ubuntu.isVersion('8.04')).toBe(true);
    expect(ubuntu.isVersion('9.04')).toBe(true);
    expect(ubuntu.isVersion('10.04.4')).toBe(true);
    expect(ubuntu.isVersion('12.04.5')).toBe(true);
    expect(ubuntu.isVersion('13.04')).toBe(true);
    expect(ubuntu.isVersion('14.04.6')).toBe(true);
    expect(ubuntu.isVersion('15.04')).toBe(true);
    expect(ubuntu.isVersion('16.04.7')).toBe(true);
    expect(ubuntu.isVersion('16.10')).toBe(true);
    expect(ubuntu.isVersion('17.04')).toBe(true);
    expect(ubuntu.isVersion('18.04.5')).toBe(true);
    expect(ubuntu.isVersion('18.10')).toBe(true);
    expect(ubuntu.isVersion('20.04')).toBe(true);
    expect(ubuntu.isVersion('20.10')).toBe(true);
    expect(ubuntu.isVersion('30.11')).toBe(true);
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

    expect(ubuntu.getMajor('18.04.5')).toBe(18);

    expect(ubuntu.getMajor('20.04')).toBe(20);
  });

  it('getMinor', () => {
    expect(ubuntu.getMinor(undefined)).toBeNull();
    expect(ubuntu.getMinor(null)).toBeNull();
    expect(ubuntu.getMinor('')).toBeNull();
    expect(ubuntu.getMinor('42')).toBeNull();
    expect(ubuntu.getMinor('2020.04')).toBeNull();

    expect(ubuntu.getMinor('04.10')).toBe(10);

    expect(ubuntu.getMinor('18.04.5')).toBe(4);

    expect(ubuntu.getMinor('20.04')).toBe(4);
  });

  it('getPatch', () => {
    expect(ubuntu.getPatch(undefined)).toBeNull();
    expect(ubuntu.getPatch(null)).toBeNull();
    expect(ubuntu.getPatch('')).toBeNull();
    expect(ubuntu.getPatch('42')).toBeNull();
    expect(ubuntu.getPatch('2020.04')).toBeNull();

    expect(ubuntu.getPatch('04.10')).toBeNull();

    expect(ubuntu.getPatch('18.04.5')).toBe(5);

    expect(ubuntu.getPatch('20.04')).toBeNull();
  });

  // comparison

  it('equals', () => {
    expect(ubuntu.equals('20.04', '2020.04')).toBe(false);

    expect(ubuntu.equals('focal', '20.04')).toBe(false);
    expect(ubuntu.equals('20.04', 'focal')).toBe(false);

    expect(ubuntu.equals('19.10', '19.10')).toBe(true);
  });

  it('isGreaterThan', () => {
    expect(ubuntu.isGreaterThan('20.04', '20.10')).toBe(false);
    expect(ubuntu.isGreaterThan('20.10', '20.04')).toBe(true);

    expect(ubuntu.isGreaterThan('19.10', '20.04')).toBe(false);
    expect(ubuntu.isGreaterThan('20.04', '19.10')).toBe(true);

    expect(ubuntu.isGreaterThan('16.04', '16.04.7')).toBe(false);
    expect(ubuntu.isGreaterThan('16.04.7', '16.04')).toBe(true);
    expect(ubuntu.isGreaterThan('16.04.1', '16.04.7')).toBe(false);
    expect(ubuntu.isGreaterThan('16.04.7', '16.04.1')).toBe(true);
    expect(ubuntu.isGreaterThan('19.10.1', '20.04.1')).toBe(false);
    expect(ubuntu.isGreaterThan('20.04.1', '19.10.1')).toBe(true);
  });

  it('getSatisfyingVersion', () => {
    const versions = ['18.10', '19.04', '19.10', '20.04'];
    expect(ubuntu.getSatisfyingVersion(versions, '2020.04')).toBeNull();
    expect(ubuntu.getSatisfyingVersion(versions, 'foobar')).toBeNull();
    expect(ubuntu.getSatisfyingVersion(versions, '20.04')).toBe('20.04');
    expect(ubuntu.getSatisfyingVersion(versions, '19.10')).toBe('19.10');
    expect(ubuntu.getSatisfyingVersion(versions, '04.10')).toBeNull();
  });

  it('minSatisfyingVersion', () => {
    const versions = ['18.10', '19.04', '19.10', '20.04'];
    expect(ubuntu.minSatisfyingVersion(versions, '2020.04')).toBeNull();
    expect(ubuntu.minSatisfyingVersion(versions, 'foobar')).toBeNull();
    expect(ubuntu.minSatisfyingVersion(versions, '20.04')).toBe('20.04');
    expect(ubuntu.minSatisfyingVersion(versions, '19.10')).toBe('19.10');
    expect(ubuntu.minSatisfyingVersion(versions, '04.10')).toBeNull();
  });

  it('getNewValue simply returns newVersion', () => {
    expect(ubuntu.getNewValue({ newVersion: 'foobar' } as never)).toEqual(
      'foobar'
    );
  });

  it('sortVersions', () => {
    const sortedVersions = ['6.10', '17.03', '18.04', '18.04', '19.10'];
    const versions = [
      ...sortedVersions.slice(2),
      ...sortedVersions.slice(0, 2),
    ];
    expect(versions.sort(ubuntu.sortVersions)).toEqual(sortedVersions);
  });

  it('matches', () => {
    expect(ubuntu.matches('20.04', '2020.04')).toBe(false);
    expect(ubuntu.matches('20.04', '20.04')).toBe(true);
    expect(ubuntu.matches('20.04', '20.04.0')).toBe(false);
  });
});
