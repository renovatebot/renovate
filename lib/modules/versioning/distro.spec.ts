import { DateTime, Settings } from 'luxon';
import { DistroInfo } from './distro';

describe('modules/versioning/distro', () => {
  const di = new DistroInfo('data/ubuntu-distro-info.json');

  beforeAll(() => {
    const dt = DateTime.fromISO('2022-03-20');
    jest.spyOn(Settings, 'now').mockReturnValue(dt.valueOf());
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  it.each`
    version            | expected
    ${'jammy'}         | ${true}
    ${'impish'}        | ${true}
    ${'hirsute'}       | ${true}
    ${'groovy'}        | ${true}
    ${'focal'}         | ${true}
    ${'eoan'}          | ${true}
    ${'Wily Werewolf'} | ${false}
    ${'asdf'}          | ${false}
    ${'Yakkety'}       | ${false}
  `('isCodename("$version") === $expected', ({ version, expected }) => {
    expect(di.isCodename(version)).toBe(expected);
  });

  it.each`
    version      | expected
    ${'jammy'}   | ${'22.04'}
    ${'impish'}  | ${'21.10'}
    ${'hirsute'} | ${'21.04'}
    ${'groovy'}  | ${'20.10'}
    ${'focal'}   | ${'20.04'}
    ${'eoan'}    | ${'19.10'}
    ${'asd'}     | ${'asd'}
    ${'16.06'}   | ${'16.06'}
  `(
    'getVersionByCodename("$version") === $expected',
    ({ version, expected }) => {
      expect(di.getVersionByCodename(version)).toBe(expected);
    }
  );

  it.each`
    version    | expected
    ${'22.04'} | ${'jammy'}
    ${'21.10'} | ${'impish'}
    ${'21.04'} | ${'hirsute'}
    ${'20.10'} | ${'groovy'}
    ${'20.04'} | ${'focal'}
    ${'19.10'} | ${'eoan'}
    ${'asd'}   | ${'asd'}
    ${'16.06'} | ${'16.06'}
  `(
    'getCodenameByVersion("$version") === $expected',
    ({ version, expected }) => {
      expect(di.getCodenameByVersion(version)).toBe(expected);
    }
  );

  it.each`
    version            | expected
    ${'jammy'}         | ${true}
    ${'impish'}        | ${true}
    ${'hirsute'}       | ${true}
    ${'groovy'}        | ${true}
    ${'focal'}         | ${true}
    ${'Wily Werewolf'} | ${false}
    ${'22.04'}         | ${true}
    ${'21.10'}         | ${true}
    ${'21.04'}         | ${true}
    ${'20.10'}         | ${true}
    ${'Wily Werewolf'} | ${false}
    ${'asdf'}          | ${false}
    ${'Jellyfish'}     | ${false}
  `('exists("$version") === $expected', ({ version, expected }) => {
    expect(di.exists(version)).toBe(expected);
  });

  it.each`
    version      | expected
    ${'focal'}   | ${false}
    ${'groovy'}  | ${true}
    ${'hirsute'} | ${true}
    ${'impish'}  | ${false}
    ${'jammy'}   | ${false}
    ${'20.04'}   | ${false}
    ${'20.10'}   | ${true}
    ${'21.04'}   | ${true}
    ${'21.10'}   | ${false}
    ${'22.04'}   | ${false}
  `('isEolLts("$version") === $expected', ({ version, expected }) => {
    expect(di.isEolLts(version)).toBe(expected);
  });

  it.each`
    version      | expected
    ${'focal'}   | ${true}
    ${'groovy'}  | ${true}
    ${'hirsute'} | ${true}
    ${'impish'}  | ${true}
    ${'jammy'}   | ${false}
    ${'20.04'}   | ${true}
    ${'20.10'}   | ${true}
    ${'21.04'}   | ${true}
    ${'21.10'}   | ${true}
    ${'22.04'}   | ${false}
    ${'24.04'}   | ${false}
  `('isReleased("$version") === $expected', ({ version, expected }) => {
    expect(di.isReleased(version)).toBe(expected);
  });

  it('retrieves schedule of the most recent release', () => {
    expect(di.getNLatest(0)).toEqual({
      codename: 'Impish Indri',
      series: 'impish',
      created: '2021-04-22',
      release: '2021-10-14',
      eol: '2022-07-14',
      version: '21.10',
    });
  });

  it('sends an out of bound argument', () => {
    expect(di.getNLatest(-1)).toBeNull();
  });

  it('sends a float as an argument', () => {
    expect(di.getNLatest(0.1)).toEqual({
      codename: 'Impish Indri',
      series: 'impish',
      created: '2021-04-22',
      release: '2021-10-14',
      eol: '2022-07-14',
      version: '21.10',
    });
  });

  it('retrieves schedule of the previous release', () => {
    expect(di.getNLatest(1)).toEqual({
      codename: 'Hirsute Hippo',
      created: '2020-10-22',
      eol: '2022-01-20',
      release: '2021-04-22',
      series: 'hirsute',
      version: '21.04',
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
    expect(di.getSchedule('20.06')).toBeNull();
  });
});
