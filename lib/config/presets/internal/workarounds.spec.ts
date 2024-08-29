import * as versionings from '../../../modules/versioning';
import { regEx } from '../../../util/regex';
import { presets } from './workarounds';

describe('config/presets/internal/workarounds', () => {
  describe('bitnamiDockerImageVersioning', () => {
    const versioning = versionings.get(presets.bitnamiDockerImageVersioning.packageRules![0]
      .versioning as string);
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
      expect(versioning.isValid(input)).toEqual(expected);
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

  describe('libericaJdkDockerVersioning', () => {
    const preset = presets.libericaJdkDockerVersioning;

    describe('Liberica JDK Lite', () => {
      const packageRule = preset.packageRules![0];

      const versioning = versionings.get(packageRule.versioning as string);

      const matchCurrentValue = packageRule.matchCurrentValue as string;
      const matchCurrentValueRe = regEx(
        matchCurrentValue.substring(1, matchCurrentValue.length - 1),
      );

      it.each`
        input                           | expected
        ${'jdk-17-glibc'}               | ${true}
        ${'jdk-all-17-glibc'}           | ${false}
        ${'jre-17-glibc'}               | ${false}
        ${'jdk-21-crac-slim-glibc'}     | ${true}
        ${'jdk-all-21-crac-slim-glibc'} | ${false}
        ${'jre-21-crac-slim-glibc'}     | ${false}
        ${'jdk-11-slim-musl'}           | ${true}
        ${'jdk-all-11-slim-musl'}       | ${false}
        ${'jre-11-slim-musl'}           | ${false}
      `('versioning("$input") == "$expected"', ({ input, expected }) => {
        expect(versioning.isValid(input)).toEqual(expected);
      });

      it.each`
        input                           | expected
        ${'jdk-17-glibc'}               | ${true}
        ${'jdk-all-17-glibc'}           | ${false}
        ${'jre-17-glibc'}               | ${false}
        ${'jdk-21-crac-slim-glibc'}     | ${true}
        ${'jdk-all-21-crac-slim-glibc'} | ${false}
        ${'jre-21-crac-slim-glibc'}     | ${false}
        ${'jdk-11-slim-musl'}           | ${true}
        ${'jdk-all-11-slim-musl'}       | ${false}
        ${'jre-11-slim-musl'}           | ${false}
      `('matchCurrentValue("$input") == "$expected"', ({ input, expected }) => {
        expect(matchCurrentValueRe.test(input)).toEqual(expected);
      });
    });

    describe('Liberica JDK', () => {
      const packageRule = preset.packageRules![1];

      const versioning = versionings.get(packageRule.versioning as string);

      const matchCurrentValue = packageRule.matchCurrentValue as string;
      const matchCurrentValueRe = regEx(
        matchCurrentValue.substring(1, matchCurrentValue.length - 1),
      );

      it.each`
        input                           | expected
        ${'jdk-17-glibc'}               | ${false}
        ${'jdk-all-17-glibc'}           | ${true}
        ${'jre-17-glibc'}               | ${false}
        ${'jdk-21-crac-slim-glibc'}     | ${false}
        ${'jdk-all-21-crac-slim-glibc'} | ${true}
        ${'jre-21-crac-slim-glibc'}     | ${false}
        ${'jdk-11-slim-musl'}           | ${false}
        ${'jdk-all-11-slim-musl'}       | ${true}
        ${'jre-11-slim-musl'}           | ${false}
      `('versioning("$input") == "$expected"', ({ input, expected }) => {
        expect(versioning.isValid(input)).toEqual(expected);
      });

      it.each`
        input                           | expected
        ${'jdk-17-glibc'}               | ${false}
        ${'jdk-all-17-glibc'}           | ${true}
        ${'jre-17-glibc'}               | ${false}
        ${'jdk-21-crac-slim-glibc'}     | ${false}
        ${'jdk-all-21-crac-slim-glibc'} | ${true}
        ${'jre-21-crac-slim-glibc'}     | ${false}
        ${'jdk-11-slim-musl'}           | ${false}
        ${'jdk-all-11-slim-musl'}       | ${true}
        ${'jre-11-slim-musl'}           | ${false}
      `('matchCurrentValue("$input") == "$expected"', ({ input, expected }) => {
        expect(matchCurrentValueRe.test(input)).toEqual(expected);
      });
    });

    describe('Liberica JRE', () => {
      const packageRule = preset.packageRules![2];

      const versioning = versionings.get(packageRule.versioning as string);

      const matchCurrentValue = packageRule.matchCurrentValue as string;
      const matchCurrentValueRe = regEx(
        matchCurrentValue.substring(1, matchCurrentValue.length - 1),
      );

      it.each`
        input                           | expected
        ${'jdk-17-glibc'}               | ${false}
        ${'jdk-all-17-glibc'}           | ${false}
        ${'jre-17-glibc'}               | ${true}
        ${'jdk-21-crac-slim-glibc'}     | ${false}
        ${'jdk-all-21-crac-slim-glibc'} | ${false}
        ${'jre-21-crac-slim-glibc'}     | ${true}
        ${'jdk-11-slim-musl'}           | ${false}
        ${'jdk-all-11-slim-musl'}       | ${false}
        ${'jre-11-slim-musl'}           | ${true}
      `('versioning("$input") == "$expected"', ({ input, expected }) => {
        expect(versioning.isValid(input)).toEqual(expected);
      });

      it.each`
        input                           | expected
        ${'jdk-17-glibc'}               | ${false}
        ${'jdk-all-17-glibc'}           | ${false}
        ${'jre-17-glibc'}               | ${true}
        ${'jdk-21-crac-slim-glibc'}     | ${false}
        ${'jdk-all-21-crac-slim-glibc'} | ${false}
        ${'jre-21-crac-slim-glibc'}     | ${true}
        ${'jdk-11-slim-musl'}           | ${false}
        ${'jdk-all-11-slim-musl'}       | ${false}
        ${'jre-11-slim-musl'}           | ${true}
      `('matchCurrentValue("$input") == "$expected"', ({ input, expected }) => {
        expect(matchCurrentValueRe.test(input)).toEqual(expected);
      });
    });
  });

  describe('javaLTSVersions', () => {
    const preset = presets.javaLTSVersions;

    describe('bellsoft/liberica-runtime-container', () => {
      const packageRule = preset.packageRules![2];

      const allowedVersions = packageRule.allowedVersions as string;
      const allowedVersionsRe = regEx(
        allowedVersions.substring(1, allowedVersions.length - 1),
      );

      it.each`
        input                           | expected
        ${'jdk-11-slim-musl'}           | ${true}
        ${'jdk-all-11-slim-musl'}       | ${true}
        ${'jre-11-slim-musl'}           | ${true}
        ${'jdk-17-glibc'}               | ${true}
        ${'jdk-all-17-glibc'}           | ${true}
        ${'jre-17-glibc'}               | ${true}
        ${'jdk-21-crac-slim-glibc'}     | ${true}
        ${'jdk-all-21-crac-slim-glibc'} | ${true}
        ${'jre-21-crac-slim-glibc'}     | ${true}
        ${'jdk-22-crac-slim-glibc'}     | ${false}
        ${'jdk-all-22-crac-slim-glibc'} | ${false}
        ${'jre-22-crac-slim-glibc'}     | ${false}
      `('allowedVersisons("$input") == "$expected"', ({ input, expected }) => {
        expect(allowedVersionsRe.test(input)).toEqual(expected);
      });
    });
  });
});
