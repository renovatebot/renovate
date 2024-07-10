import { regEx } from '../../../util/regex';
import { presets } from './workarounds';

describe('config/presets/internal/workarounds', () => {
  describe('bitnamiDockerImageVersioning', () => {
    const versioning = presets.bitnamiDockerImageVersioning.packageRules![0]
      .versioning as string;
    const versioningRe = regEx(versioning.substring(6));
    const matchCurrentValue = presets.bitnamiDockerImageVersioning
      .packageRules![0].matchCurrentValue as string;
    const matchCurrentValueRe = regEx(
      matchCurrentValue.substring(1, matchCurrentValue.length - 1),
    );

    it.each`
      input                     | expected
      ${'latest'}               | ${false}
      ${'20'}                   | ${true}
      ${'20-debian'}            | ${false}
      ${'20-debian-12'}         | ${true}
      ${'1.24'}                 | ${true}
      ${'1.24-debian-12'}       | ${true}
      ${'1.24.0'}               | ${true}
      ${'1.24.0-debian-12'}     | ${true}
      ${'1.24.0-debian-12-r24'} | ${true}
    `('versioning("$input") == "$expected"', ({ input, expected }) => {
      expect(versioningRe.test(input)).toEqual(expected);
    });

    it.each`
      input                     | expected
      ${'latest'}               | ${false}
      ${'20'}                   | ${false}
      ${'20-debian'}            | ${false}
      ${'20-debian-12'}         | ${true}
      ${'1.24'}                 | ${false}
      ${'1.24-debian-12'}       | ${true}
      ${'1.24.0'}               | ${false}
      ${'1.24.0-debian-12'}     | ${true}
      ${'1.24.0-debian-12-r24'} | ${true}
    `('matchCurrentValue("$input") == "$expected"', ({ input, expected }) => {
      expect(matchCurrentValueRe.test(input)).toEqual(expected);
    });
  });
});
