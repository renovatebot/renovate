import dataFiles from '../../../data-files.generated.ts';
import { logger } from '../../../logger.ts';
import { DistroInfo } from '../distro.ts';
import {
  RollingReleasesData,
  getDatedContainerImageCodename,
  getDatedContainerImageSuffix,
  getDatedContainerImageVersion,
  isDatedCodeName,
} from './common.ts';

describe('modules/versioning/debian/common', () => {
  const distroInfo = new DistroInfo('data/debian-distro-info.json');

  it('no rolling release data', () => {
    dataFiles.set('data/debian-distro-info.json', '{}');

    const distroInfo = new DistroInfo('data/debian-distro-info.json');
    const rollingReleases = new RollingReleasesData(distroInfo);

    expect(rollingReleases.has('buster')).toBeFalse();
    expect(rollingReleases.has('trixie')).toBeFalse();
    expect(logger.debug).toHaveBeenCalledTimes(1);

    expect(logger.debug).toHaveBeenCalledWith(
      'RollingReleasesData - data written',
    );
  });

  describe('isDatedCodeName', () => {
    it.each`
      input                    | expected
      ${'buster'}              | ${false}
      ${'buster-20220101'}     | ${true}
      ${'bullseye-20220101'}   | ${true}
      ${'bookworm-20230816'}   | ${true}
      ${'bookworm-20230816.1'} | ${true}
      ${'invalid-20220101'}    | ${false}
      ${'buster-2022010'}      | ${false}
      ${'buster-202201011'}    | ${false}
      ${'buster-20220101.123'} | ${false}
    `('isDatedCodeName("$input") === $expected', ({ input, expected }) => {
      expect(isDatedCodeName(input, distroInfo)).toBe(expected);
    });
  });

  describe('getDatedContainerImageCodename', () => {
    it.each`
      input                    | expected
      ${'buster-20220101'}     | ${'buster'}
      ${'bullseye-20220101'}   | ${'bullseye'}
      ${'bookworm-20230816'}   | ${'bookworm'}
      ${'bookworm-20230816.1'} | ${'bookworm'}
      ${'buster'}              | ${null}
      ${'invalid-20220101'}    | ${'invalid'}
      ${'buster-2022010'}      | ${null}
      ${'buster-20220101.123'} | ${null}
      ${'buster-20220101a'}    | ${null}
      ${'buster-20220101-'}    | ${null}
    `(
      'getDatedContainerImageCodename("$input") === $expected',
      ({ input, expected }) => {
        expect(getDatedContainerImageCodename(input)).toBe(expected);
      },
    );
  });

  describe('getDatedContainerImageVersion', () => {
    it.each`
      input                    | expected
      ${'buster-20220101'}     | ${20220101}
      ${'bullseye-20220101'}   | ${20220101}
      ${'bookworm-20230816'}   | ${20230816}
      ${'bookworm-20230816.1'} | ${20230816}
      ${'buster'}              | ${null}
      ${'invalid-20220101'}    | ${20220101}
      ${'buster-2022010'}      | ${null}
    `(
      'getDatedContainerImageVersion("$input") === $expected',
      ({ input, expected }) => {
        expect(getDatedContainerImageVersion(input)).toBe(expected);
      },
    );
  });

  describe('getDatedContainerImageSuffix', () => {
    it.each`
      input                    | expected
      ${'buster-20220101'}     | ${null}
      ${'bullseye-20220101'}   | ${null}
      ${'bookworm-20230816'}   | ${null}
      ${'bookworm-20230816.1'} | ${'.1'}
      ${'buster-20220101.2'}   | ${'.2'}
      ${'buster'}              | ${null}
      ${'invalid-20220101'}    | ${null}
      ${'buster-2022010'}      | ${null}
    `(
      'getDatedContainerImageSuffix("$input") === $expected',
      ({ input, expected }) => {
        expect(getDatedContainerImageSuffix(input)).toBe(expected);
      },
    );
  });
});
