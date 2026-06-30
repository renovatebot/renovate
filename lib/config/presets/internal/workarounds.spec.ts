import * as versionings from '../../../modules/versioning/index.ts';
import { matchRegexOrGlob } from '../../../util/string-match.ts';
import { presets } from './workarounds.preset.ts';

describe('config/presets/internal/workarounds', () => {
  describe('bitnamiDockerImageVersioning', () => {
    const preset = presets.bitnamiDockerImageVersioning;
    const packageRule = preset.packageRules![0];

    const versioning = versionings.get(packageRule.versioning);
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

  describe('clamavDockerImageVersioning', () => {
    const preset = presets.clamavDockerImageVersioning;
    const packageRule = preset.packageRules![0];
    const versioning = versionings.get(packageRule.versioning);

    it.each`
      input              | expected
      ${'latest'}        | ${false}
      ${'latest_base'}   | ${false}
      ${'stable'}        | ${false}
      ${'stable_base'}   | ${false}
      ${'unstable'}      | ${false}
      ${'unstable_base'} | ${false}
      ${'20'}            | ${false}
      ${'20_base'}       | ${false}
      ${'1.24'}          | ${true}
      ${'1.24_base'}     | ${true}
      ${'1.24.0'}        | ${true}
      ${'1.24.0_base'}   | ${true}
      ${'1.5.1-17'}      | ${true}
      ${'1.5.1-17_base'} | ${true}
    `('versioning("$input") == "$expected"', ({ input, expected }) => {
      expect(versioning.isValid(input)).toEqual(expected);
    });
  });

  describe('grafanaDockerImageVersioning', () => {
    const preset = presets.grafanaDockerImageVersioning;
    const packageRule = preset.packageRules![0];
    const versioning = versionings.get(packageRule.versioning);
    const matchPackageNames = packageRule.matchPackageNames!;

    it.each`
      input                          | expected
      ${'latest'}                    | ${false}
      ${'main'}                      | ${false}
      ${'13'}                        | ${false}
      ${'13.0'}                      | ${false}
      ${'13.0.1'}                    | ${true}
      ${'13.0.1-security-01'}        | ${true}
      ${'13.0.1-security-01-fips'}   | ${true}
      ${'13.0.1-security-01-ubi'}    | ${true}
      ${'13.0.1-security-01-ubuntu'} | ${true}
      ${'13.0.2'}                    | ${true}
      ${'13.0.2-ubuntu'}             | ${true}
    `('versioning("$input") == "$expected"', ({ input, expected }) => {
      expect(versioning.isValid(input)).toEqual(expected);
    });

    it.each`
      input                          | expected
      ${'grafana/grafana'}           | ${true}
      ${'docker.io/grafana/grafana'} | ${true}
      ${'grafana/loki'}              | ${false}
      ${'ghcr.io/grafana/grafana'}   | ${false}
    `('matchPackageNames("$input") == "$expected"', ({ input, expected }) => {
      expect(
        matchPackageNames.some((pattern) => matchRegexOrGlob(input, pattern)),
      ).toEqual(expected);
    });

    it.each`
      version                        | current                        | expected
      ${'13.0.1-security-01'}        | ${'13.0.1'}                    | ${true}
      ${'13.0.2'}                    | ${'13.0.1-security-01'}        | ${true}
      ${'13.0.1-security-01-ubuntu'} | ${'13.0.1-ubuntu'}             | ${true}
      ${'13.0.2-ubuntu'}             | ${'13.0.1-security-01-ubuntu'} | ${true}
      ${'13.0.1-security-01-ubuntu'} | ${'13.0.1-security-01'}        | ${false}
    `(
      'isGreaterThan("$version", "$current") == "$expected"',
      ({ version, current, expected }) => {
        expect(versioning.isGreaterThan(version, current)).toEqual(expected);
      },
    );
  });

  describe('libericaJdkDockerVersioning', () => {
    const preset = presets.libericaJdkDockerVersioning;

    describe('Liberica JDK Lite', () => {
      const packageRule = preset.packageRules![0];

      const versioning = versionings.get(packageRule.versioning);

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

      const versioning = versionings.get(packageRule.versioning);

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

      const versioning = versionings.get(packageRule.versioning);

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

      const allowedVersions = packageRule.allowedVersions!;

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
