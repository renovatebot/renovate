import * as versionings from '../../../modules/versioning';
import { matchRegexOrGlob } from '../../../util/string-match';
import { presets } from './workarounds';

describe('config/presets/internal/workarounds', () => {
  describe('bitnamiDockerImageVersioning', () => {
    const preset = presets.bitnamiDockerImageVersioning;
    const packageRule = preset.packageRules![0];

    const versioning = versionings.get(packageRule.versioning as string);
    const matchCurrentValue = packageRule.matchCurrentValue!;

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
      expect(matchRegexOrGlob(input, matchCurrentValue)).toEqual(expected);
    });
  });

  describe('libericaJdkDockerVersioning', () => {
    const preset = presets.libericaJdkDockerVersioning;

    describe('Liberica JDK Lite', () => {
      const packageRule = preset.packageRules![0];

      const versioning = versionings.get(packageRule.versioning as string);

      const matchCurrentValue = packageRule.matchCurrentValue!;

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
        expect(matchRegexOrGlob(input, matchCurrentValue)).toEqual(expected);
      });
    });

    describe('Liberica JDK', () => {
      const packageRule = preset.packageRules![1];

      const versioning = versionings.get(packageRule.versioning as string);

      const matchCurrentValue = packageRule.matchCurrentValue!;

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
        expect(matchRegexOrGlob(input, matchCurrentValue)).toEqual(expected);
      });
    });

    describe('Liberica JRE', () => {
      const packageRule = preset.packageRules![2];

      const versioning = versionings.get(packageRule.versioning as string);

      const matchCurrentValue = packageRule.matchCurrentValue!;

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
        expect(matchRegexOrGlob(input, matchCurrentValue)).toEqual(expected);
      });
    });
  });

  describe('javaLTSVersions', () => {
    const preset = presets.javaLTSVersions;

    describe('bellsoft/liberica-runtime-container', () => {
      const packageRule = preset.packageRules![2];

      const allowedVersions = packageRule.allowedVersions as string;

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
        expect(matchRegexOrGlob(input, allowedVersions)).toEqual(expected);
      });
    });
  });
});
