import * as versionings from '../../../modules/versioning/index.ts';
import type { VersioningApi } from '../../../modules/versioning/types.ts';
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

  describe('byteBuddyMavenArtifactVersioning', () => {
    const preset = presets.byteBuddyMavenArtifactVersioning;
    const packageRule = preset.packageRules![0];
    const versioning = versionings.get(packageRule.versioning);

    it.each`
    input                | expected
    ${'1.0.0'}           | ${true}
    ${'1.0.0-jdk5'}      | ${true}
    ${'1.0.0-jdk6-jdk5'} | ${true}
    `('versioning("$input") == "$expected"', ({ input, expected }) => {
      expect(versioning.isValid(input)).toEqual(expected);
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
    // Indices: 0 regex+names, 1 regex+deps, 2 temurin regex+names, 3 temurin regex+deps, 4 docker major-only+names, 5 docker major-only+deps, 6 mise partial, 7 liberica
    const regexPackageRule = packageRules[0];
    const majorOnlyPackageRule = packageRules[4];
    const majorOnlyDepRule = packageRules[5];
    const libericaRule = packageRules[7];
    const javaRegexVersioning = regexPackageRule.versioning;
    const temurinRegexVersioning = packageRules[2].versioning;

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
        const res = await applyPackageRules<
          PackageRuleInputConfig & Pick<PackageRule, 'allowedVersions'>
        >({
          datasource: 'docker',
          depName: 'eclipse-temurin',
          packageName: 'eclipse-temurin',
          currentValue: '21-jre',
          packageRules,
        });

        expect(res.versioning).toEqual('docker');
        expect(res.allowedVersions).toEqual('/^(?:8|11|17|21|25)(?:\\.|-|$)/');
      });

      it('keeps regex versioning for full-precision current values', async () => {
        const res = await applyPackageRules<
          PackageRuleInputConfig & Pick<PackageRule, 'allowedVersions'>
        >({
          datasource: 'docker',
          depName: 'eclipse-temurin',
          packageName: 'eclipse-temurin',
          currentValue: '21.0.9_10-jre',
          packageRules,
        });

        expect(res.versioning).toEqual(temurinRegexVersioning);
        expect(res.allowedVersions).toEqual('/^(?:8|11|17|21|25)(?:\\.|-|$)/');
      });

      it('keeps regex versioning for java-version values in other managers', async () => {
        const res = await applyPackageRules<
          PackageRuleInputConfig & Pick<PackageRule, 'allowedVersions'>
        >({
          datasource: 'java-version',
          depName: 'java',
          manager: 'asdf',
          packageName: 'java-jdk',
          currentValue: '21',
          packageRules,
        });

        expect(res.versioning).toEqual(javaRegexVersioning);
      });

      it.each`
        manager             | currentValue | expectedVersioning
        ${'mise'}           | ${'21'}      | ${'semver-partial'}
        ${'mise'}           | ${'21.0'}    | ${'semver-partial'}
        ${'mise'}           | ${'21.0.9'}  | ${javaRegexVersioning}
        ${'github-actions'} | ${'21'}      | ${'semver-partial'}
        ${'github-actions'} | ${'21.0'}    | ${'semver-partial'}
        ${'github-actions'} | ${'21.0.9'}  | ${javaRegexVersioning}
      `(
        'uses $expectedVersioning versioning for $manager Java version $currentValue',
        async ({ manager, currentValue, expectedVersioning }) => {
          const res = await applyPackageRules<
            PackageRuleInputConfig & Pick<PackageRule, 'allowedVersions'>
          >({
            datasource: 'java-version',
            depName: 'java',
            manager,
            packageName: 'java-jdk',
            currentValue,
            packageRules,
            versioning: 'semver-partial',
          });

          expect(res.versioning).toEqual(expectedVersioning);
          expect(res.allowedVersions).toEqual(
            '/^(?:8|11|17|21|25)(?:\\.|-|$)/',
          );
        },
      );
    });

    describe('eclipse-temurin four-part versions', () => {
      async function temurinVersioning(
        currentValue: string,
        rule: 'packageName' | 'depName' = 'packageName',
      ): Promise<VersioningApi> {
        const res = await applyPackageRules<PackageRuleInputConfig>({
          datasource: 'docker',
          depName: rule === 'depName' ? 'eclipse-temurin' : 'base',
          packageName:
            rule === 'packageName' ? 'eclipse-temurin' : 'mirror/temurin',
          currentValue,
          packageRules,
        });
        return versionings.get(res.versioning);
      }

      it.each`
        version
        ${'25.0.5_8-jdk-resolute'}
        ${'25.0.5.1_2-jdk-resolute'}
        ${'25.0.6_10-jdk-resolute'}
        ${'17.0.4.1_1-jdk-jammy'}
        ${'17.0.21.1_2-jdk-noble'}
        ${'21.0.13.1_2-jre'}
        ${'21.0.13.1_2'}
      `('isVersion($version) == true', async ({ version }) => {
        const versioning = await temurinVersioning(version);

        expect(versioning.isVersion(version)).toBeTrue();
      });

      it.each`
        rule
        ${'packageName'}
        ${'depName'}
      `(
        'sorts a four-part version between its neighbours ($rule rule)',
        async ({ rule }) => {
          const versioning = await temurinVersioning(
            '25.0.5_8-jdk-resolute',
            rule,
          );

          expect(
            [
              '25.0.6_10-jdk-resolute',
              '25.0.5.1_2-jdk-resolute',
              '25.0.5_8-jdk-resolute',
            ].sort((a, b) => versioning.sortVersions(a, b)),
          ).toEqual([
            '25.0.5_8-jdk-resolute',
            '25.0.5.1_2-jdk-resolute',
            '25.0.6_10-jdk-resolute',
          ]);
        },
      );

      it('offers a four-part release as an update from three parts', async () => {
        const versioning = await temurinVersioning('17.0.4_8-jdk-jammy');

        expect(
          versioning.isGreaterThan(
            '17.0.4.1_1-jdk-jammy',
            '17.0.4_8-jdk-jammy',
          ),
        ).toBeTrue();
        expect(
          versioning.isCompatible('17.0.4.1_1-jdk-jammy', '17.0.4_8-jdk-jammy'),
        ).toBeTrue();
        expect(
          versioning.getNewValue({
            currentValue: '17.0.4_8-jdk-jammy',
            rangeStrategy: 'replace',
            newVersion: '17.0.4.1_1-jdk-jammy',
          }),
        ).toBe('17.0.4.1_1-jdk-jammy');
      });

      it('keeps docker versioning for major-only tags', async () => {
        const res = await applyPackageRules<PackageRuleInputConfig>({
          datasource: 'docker',
          depName: 'eclipse-temurin',
          packageName: 'eclipse-temurin',
          currentValue: '25-jdk-resolute',
          packageRules,
        });

        expect(res.versioning).toBe('docker');
      });

      it.each`
        datasource        | depName                | packageName            | currentValue
        ${'docker'}       | ${'sapmachine'}        | ${'sapmachine'}        | ${'17.0.21.0.2-jdk'}
        ${'docker'}       | ${'azul/zulu-openjdk'} | ${'azul/zulu-openjdk'} | ${'17.0.21.0.3-17.70'}
        ${'docker'}       | ${'adoptopenjdk'}      | ${'adoptopenjdk'}      | ${'11.0.7_10.1-jdk-hotspot'}
        ${'java-version'} | ${'java'}              | ${'java-jdk'}          | ${'21.0.9+10.0.LTS'}
      `(
        'keeps the Java regex versioning for $packageName $currentValue',
        async ({ datasource, depName, packageName, currentValue }) => {
          const res = await applyPackageRules<PackageRuleInputConfig>({
            datasource,
            depName,
            packageName,
            currentValue,
            packageRules,
          });

          expect(res.versioning).toBe(javaRegexVersioning);
          expect(
            versionings.get(res.versioning).isVersion(currentValue),
          ).toBeTrue();
        },
      );
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

  describe('helmDocs', () => {
    const preset = presets.helmDocs;

    const allowedVersions = preset.packageRules![0].allowedVersions!;
    it.each`
      input        | expected
      ${'19.0614'} | ${false}
      ${'19.0110'} | ${false}
      ${'v0.1.0'}  | ${true}
      ${'v1.13.1'} | ${true}
    `('allowedVersions("$input") == "$expected"', ({ input, expected }) => {
      expect(matchRegexOrGlob(input, allowedVersions)).toEqual(expected);
    });
  });
});
