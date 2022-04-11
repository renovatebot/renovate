import { DistroInfo } from './distro';

describe('modules/versioning/distro', () => {
  const di = new DistroInfo('data/ubuntu-distro-info.json');

  test.each`
    version            | expected
    ${'warty'}         | ${true}
    ${'focal'}         | ${true}
    ${'breezy'}        | ${true}
    ${'edgy'}          | ${true}
    ${'lucid'}         | ${true}
    ${'xenial'}        | ${true}
    ${'Wily Werewolf'} | ${false}
    ${'asdf'}          | ${false}
    ${'Yakkety'}       | ${false}
  `('isCodename("$version") === $expected', ({ version, expected }) => {
    expect(di.isCodename(version)).toBe(expected);
  });

  test.each`
    version     | expected
    ${'warty'}  | ${'4.10'}
    ${'focal'}  | ${'20.04'}
    ${'breezy'} | ${'5.10'}
    ${'edgy'}   | ${'6.10'}
    ${'lucid'}  | ${'10.04'}
    ${'xenial'} | ${'16.04'}
    ${'asd'}    | ${'asd'}
    ${'16.06'}  | ${'16.06'}
  `(
    'getVersionByCodename("$version") === $expected',
    ({ version, expected }) => {
      expect(di.getVersionByCodename(version)).toBe(expected);
    }
  );

  test.each`
    version     | expected
    ${'4.10'}   | ${'warty'}
    ${'20.04'}  | ${'focal'}
    ${'5.10'}   | ${'breezy'}
    ${'6.10'}   | ${'edgy'}
    ${'10.04'}  | ${'lucid'}
    ${'16.04'}  | ${'xenial'}
    ${'asd'}    | ${'asd'}
    ${'16.06'}  | ${'16.06'}
    ${'breezy'} | ${'breezy'}
  `(
    'getCodenameByVersion("$version") === $expected',
    ({ version, expected }) => {
      expect(di.getCodenameByVersion(version)).toBe(expected);
    }
  );

  test.each`
    version            | expected
    ${'warty'}         | ${true}
    ${'focal'}         | ${true}
    ${'breezy'}        | ${true}
    ${'edgy'}          | ${true}
    ${'lucid'}         | ${true}
    ${'xenial'}        | ${true}
    ${'Wily Werewolf'} | ${false}
    ${'asdf'}          | ${false}
    ${'Yakkety'}       | ${false}
    ${'20.04'}         | ${true}
    ${'5.10'}          | ${true}
    ${'6.10'}          | ${true}
    ${'10.04'}         | ${true}
    ${'16.04'}         | ${true}
    ${'Wily Werewolf'} | ${false}
    ${'asdf'}          | ${false}
    ${'Yakkety'}       | ${false}
  `('exists("$version") === $expected', ({ version, expected }) => {
    expect(di.exists(version)).toBe(expected);
  });

  test.each`
    version     | expected
    ${'warty'}  | ${true}
    ${'breezy'} | ${true}
    ${'edgy'}   | ${true}
    ${'lucid'}  | ${true}
    ${'xenial'} | ${true}
    ${'5.10'}   | ${true}
    ${'6.10'}   | ${true}
    ${'10.04'}  | ${true}
    ${'16.04'}  | ${true}
    ${'20.04'}  | ${false}
    ${'focal'}  | ${false}
    ${'21.04'}  | ${true}
    ${'21.10'}  | ${false}
    ${'22.04'}  | ${false}
  `('isEolLts("$version") === $expected', ({ version, expected }) => {
    expect(di.isEolLts(version)).toBe(expected);
  });

  it('retrieves most recent release schedule with version', () => {
    expect(di.getNLatest(0)).toEqual({
      codename: 'Jammy Jellyfish',
      created: '2021-10-14',
      eol: '2027-04-21',
      eol_esm: '2032-04-21',
      eol_server: '2027-04-21',
      release: '2022-04-21',
      series: 'jammy',
      version: '22.04',
    });
  });

  it('retrieves before most recent release schedule with version', () => {
    expect(di.getNLatest(1)).toEqual({
      codename: 'Impish Indri',
      series: 'impish',
      created: '2021-04-22',
      release: '2021-10-14',
      eol: '2022-07-14',
      version: '21.10',
    });
  });

  it('retrieves warty release schedule', () => {
    expect(di.getSchedule('4.10')).toEqual({
      codename: 'Warty Warthog',
      created: '2004-03-05',
      eol: '2006-04-30',
      release: '2004-10-20',
      series: 'warty',
    });
  });

  it('retrieves focal release schedule', () => {
    expect(di.getSchedule('20.04')).toEqual({
      codename: 'Focal Fossa',
      created: '2019-10-17',
      eol: '2025-04-23',
      eol_esm: '2030-04-23',
      eol_server: '2025-04-23',
      release: '2020-04-23',
      series: 'focal',
    });
  });

  it('retrieves non-existent release schedule', () => {
    expect(di.getSchedule('20.06')).toBeUndefined();
  });
});
