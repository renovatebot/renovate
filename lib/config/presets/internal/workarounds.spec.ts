import * as versionings from '../../../modules/versioning/index.ts';
import { applyPackageRules } from '../../../util/package-rules/index.ts';
import { matchRegexOrGlob } from '../../../util/string-match.ts';
import type { PackageRule, PackageRuleInputConfig } from '../../types.ts';
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
    const packageRules = preset.packageRules!;
    // Indices: 0 regex+names, 1 regex+deps, 2 docker major-only+names, 3 docker major-only+deps, 4 liberica
    const regexPackageRule = packageRules[0];
    const majorOnlyPackageRule = packageRules[2];
    const majorOnlyDepRule = packageRules[3];
    const libericaRule = packageRules[4];
    const javaRegexVersioning = regexPackageRule.versioning;

    describe('major-only docker tag override', () => {
      const matchCurrentValue = majorOnlyPackageRule.matchCurrentValue!;

      it.each`
        input                      | expected
        ${'21'}                    | ${true}
        ${'21-jre'}                | ${true}
        ${'21-jre-jammy'}          | ${true}
        ${'25-jre'}                | ${true}
        ${'8-jdk'}                 | ${true}
        ${'8-jdk-alpine'}          | ${true}
        ${'21.0'}                  | ${false}
        ${'21.0-jre'}              | ${false}
        ${'21.0.11_10-jre'}        | ${false}
        ${'21.0.11_10-jre-alpine'} | ${false}
        ${'jdk-21-slim-musl'}      | ${false}
        ${'latest'}                | ${false}
      `('matchCurrentValue("$input") == "$expected"', ({ input, expected }) => {
        expect(matchRegexOrGlob(input, matchCurrentValue)).toEqual(expected);
      });

      it('uses docker versioning for major-only package and dep rules', () => {
        expect(majorOnlyPackageRule.versioning).toEqual('docker');
        expect(majorOnlyDepRule.versioning).toEqual('docker');
        expect(majorOnlyDepRule.matchCurrentValue).toEqual(matchCurrentValue);
      });

      it('applies docker versioning for major-only current values', async () => {
        const res = await applyPackageRules({
          datasource: 'docker',
          depName: 'eclipse-temurin',
          packageName: 'eclipse-temurin',
          currentValue: '21-jre',
          packageRules,
        } as PackageRuleInputConfig & Pick<PackageRule, 'allowedVersions'>);

        expect(res.versioning).toEqual('docker');
        expect(res.allowedVersions).toEqual('/^(?:8|11|17|21|25)(?:\\.|-|$)/');
      });

      it('keeps regex versioning for full-precision current values', async () => {
        const res = await applyPackageRules({
          datasource: 'docker',
          depName: 'eclipse-temurin',
          packageName: 'eclipse-temurin',
          currentValue: '21.0.9_10-jre',
          packageRules,
        } as PackageRuleInputConfig & Pick<PackageRule, 'allowedVersions'>);

        expect(res.versioning).toEqual(javaRegexVersioning);
        expect(res.allowedVersions).toEqual('/^(?:8|11|17|21|25)(?:\\.|-|$)/');
      });

      it('keeps regex versioning for java-version major-only values', async () => {
        const res = await applyPackageRules({
          datasource: 'java-version',
          depName: 'java',
          packageName: 'java-jdk',
          currentValue: '21',
          packageRules,
        } as PackageRuleInputConfig & Pick<PackageRule, 'allowedVersions'>);

        expect(res.versioning).toEqual(javaRegexVersioning);
      });
    });

    describe('bellsoft/liberica-runtime-container', () => {
      const allowedVersions = libericaRule.allowedVersions!;

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
