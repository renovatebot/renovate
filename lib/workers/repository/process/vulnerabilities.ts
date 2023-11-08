// TODO #22198
import { Ecosystem, Osv, OsvOffline } from '@renovatebot/osv-offline';
import is from '@sindresorhus/is';
import type { CvssScore } from 'vuln-vects';
import { parseCvssVector } from 'vuln-vects';
import { getManagerConfig, mergeChildConfig } from '../../../config';
import type { PackageRule, RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { getDefaultVersioning } from '../../../modules/datasource/common';
import type {
  PackageDependency,
  PackageFile,
} from '../../../modules/manager/types';
import {
  VersioningApi,
  get as getVersioning,
} from '../../../modules/versioning';
import { sanitizeMarkdown } from '../../../util/markdown';
import * as p from '../../../util/promises';
import { regEx } from '../../../util/regex';
import { titleCase } from '../../../util/string';
import type {
  DependencyVulnerabilities,
  SeverityDetails,
  Vulnerability,
} from './types';

export class Vulnerabilities {
  private osvOffline: OsvOffline | undefined;

  private static readonly datasourceEcosystemMap: Record<
    string,
    Ecosystem | undefined
  > = {
    crate: 'crates.io',
    go: 'Go',
    hex: 'Hex',
    maven: 'Maven',
    npm: 'npm',
    nuget: 'NuGet',
    packagist: 'Packagist',
    pypi: 'PyPI',
    rubygems: 'RubyGems',
  };

  private constructor() {}

  private async initialize(): Promise<void> {
    this.osvOffline = await OsvOffline.create();
  }

  static async create(): Promise<Vulnerabilities> {
    const instance = new Vulnerabilities();
    await instance.initialize();
    return instance;
  }

  async appendVulnerabilityPackageRules(
    config: RenovateConfig,
    packageFiles: Record<string, PackageFile[]>,
  ): Promise<void> {
    const dependencyVulnerabilities = await this.fetchDependencyVulnerabilities(
      config,
      packageFiles,
    );

    config.packageRules ??= [];
    for (const {
      vulnerabilities,
      versioningApi,
    } of dependencyVulnerabilities) {
      const groupPackageRules: PackageRule[] = [];
      for (const vulnerability of vulnerabilities) {
        const rule = this.vulnerabilityToPackageRules(vulnerability);
        if (is.nullOrUndefined(rule)) {
          continue;
        }
        groupPackageRules.push(rule);
      }
      this.sortByFixedVersion(groupPackageRules, versioningApi);

      config.packageRules.push(...groupPackageRules);
    }
  }

  async fetchVulnerabilities(
    config: RenovateConfig,
    packageFiles: Record<string, PackageFile[]>,
  ): Promise<Vulnerability[]> {
    const groups = await this.fetchDependencyVulnerabilities(
      config,
      packageFiles,
    );
    return groups.flatMap((group) => group.vulnerabilities);
  }

  private async fetchDependencyVulnerabilities(
    config: RenovateConfig,
    packageFiles: Record<string, PackageFile[]>,
  ): Promise<DependencyVulnerabilities[]> {
    const managers = Object.keys(packageFiles);
    const allManagerJobs = managers.map((manager) =>
      this.fetchManagerVulnerabilities(config, packageFiles, manager),
    );
    return (await Promise.all(allManagerJobs)).flat();
  }

  private async fetchManagerVulnerabilities(
    config: RenovateConfig,
    packageFiles: Record<string, PackageFile[]>,
    manager: string,
  ): Promise<DependencyVulnerabilities[]> {
    const managerConfig = getManagerConfig(config, manager);
    const queue = packageFiles[manager].map(
      (pFile) => (): Promise<DependencyVulnerabilities[]> =>
        this.fetchManagerPackageFileVulnerabilities(managerConfig, pFile),
    );
    logger.trace(
      { manager, queueLength: queue.length },
      'fetchManagerVulnerabilities starting',
    );
    const result = (await p.all(queue)).flat();
    logger.trace({ manager }, 'fetchManagerVulnerabilities finished');
    return result;
  }

  private async fetchManagerPackageFileVulnerabilities(
    managerConfig: RenovateConfig,
    pFile: PackageFile,
  ): Promise<DependencyVulnerabilities[]> {
    const { packageFile } = pFile;
    const packageFileConfig = mergeChildConfig(managerConfig, pFile);
    const { manager } = packageFileConfig;
    const queue = pFile.deps.map(
      (dep) => (): Promise<DependencyVulnerabilities | null> =>
        this.fetchDependencyVulnerability(packageFileConfig, dep),
    );
    logger.trace(
      { manager, packageFile, queueLength: queue.length },
      'fetchManagerPackageFileVulnerabilities starting with concurrency',
    );

    const result = await p.all(queue);
    logger.trace(
      { packageFile },
      'fetchManagerPackageFileVulnerabilities finished',
    );

    return result.filter(is.truthy);
  }

  private async fetchDependencyVulnerability(
    packageFileConfig: RenovateConfig & PackageFile,
    dep: PackageDependency,
  ): Promise<DependencyVulnerabilities | null> {
    const ecosystem = Vulnerabilities.datasourceEcosystemMap[dep.datasource!];
    if (!ecosystem) {
      logger.trace(`Cannot map datasource ${dep.datasource!} to OSV ecosystem`);
      return null;
    }

    let packageName = dep.packageName ?? dep.depName!;
    if (ecosystem === 'PyPI') {
      // https://peps.python.org/pep-0503/#normalized-names
      packageName = packageName.toLowerCase().replace(regEx(/[_.-]+/g), '-');
    }

    try {
      const osvVulnerabilities = await this.osvOffline?.getVulnerabilities(
        ecosystem,
        packageName,
      );
      if (
        is.nullOrUndefined(osvVulnerabilities) ||
        is.emptyArray(osvVulnerabilities)
      ) {
        logger.trace(
          `No vulnerabilities found in OSV database for ${packageName}`,
        );
        return null;
      }

      const depVersion =
        dep.lockedVersion ?? dep.currentVersion ?? dep.currentValue!;

      const versioning = dep.versioning ?? getDefaultVersioning(dep.datasource);
      const versioningApi = getVersioning(versioning);

      if (!versioningApi.isVersion(depVersion)) {
        logger.debug(
          `Skipping vulnerability lookup for package ${packageName} due to unsupported version ${depVersion}`,
        );
        return null;
      }

      const vulnerabilities: Vulnerability[] = [];
      for (const osvVulnerability of osvVulnerabilities) {
        if (osvVulnerability.withdrawn) {
          logger.trace(
            `Skipping withdrawn vulnerability ${osvVulnerability.id}`,
          );
          continue;
        }

        for (const affected of osvVulnerability.affected ?? []) {
          const isVulnerable = this.isPackageVulnerable(
            ecosystem,
            packageName,
            depVersion,
            affected,
            versioningApi,
          );
          if (!isVulnerable) {
            continue;
          }

          logger.debug(
            `Vulnerability ${osvVulnerability.id} affects ${packageName} ${depVersion}`,
          );
          const fixedVersion = this.getFixedVersion(
            ecosystem,
            depVersion,
            affected,
            versioningApi,
          );

          vulnerabilities.push({
            packageName,
            vulnerability: osvVulnerability,
            affected,
            depVersion,
            fixedVersion,
            datasource: dep.datasource!,
            packageFileConfig,
          });
        }
      }

      return { vulnerabilities, versioningApi };
    } catch (err) {
      logger.warn(
        { err },
        `Error fetching vulnerability information for ${packageName}`,
      );
      return null;
    }
  }

  private sortByFixedVersion(
    packageRules: PackageRule[],
    versioningApi: VersioningApi,
  ): void {
    const versionsCleaned: Record<string, string> = {};
    for (const rule of packageRules) {
      const version = rule.allowedVersions as string;
      versionsCleaned[version] = version.replace(regEx(/[=> ]+/g), '');
    }
    packageRules.sort((a, b) =>
      versioningApi.sortVersions(
        versionsCleaned[a.allowedVersions as string],
        versionsCleaned[b.allowedVersions as string],
      ),
    );
  }

  // https://ossf.github.io/osv-schema/#affectedrangesevents-fields
  private sortEvents(
    events: Osv.Event[],
    versioningApi: VersioningApi,
  ): Osv.Event[] {
    const sortedCopy: Osv.Event[] = [];
    let zeroEvent: Osv.Event | null = null;

    for (const event of events) {
      if (event.introduced === '0') {
        zeroEvent = event;
      } else if (versioningApi.isVersion(Object.values(event)[0])) {
        sortedCopy.push(event);
      } else {
        logger.debug({ event }, 'Skipping OSV event with invalid version');
      }
    }

    sortedCopy.sort((a, b) =>
      // no pre-processing, as there are only very few values to sort
      versioningApi.sortVersions(Object.values(a)[0], Object.values(b)[0]),
    );

    if (zeroEvent) {
      sortedCopy.unshift(zeroEvent);
    }

    return sortedCopy;
  }

  private isPackageAffected(
    ecosystem: Ecosystem,
    packageName: string,
    affected: Osv.Affected,
  ): boolean {
    return (
      affected.package?.name === packageName &&
      affected.package?.ecosystem === ecosystem
    );
  }

  private includedInVersions(
    depVersion: string,
    affected: Osv.Affected,
  ): boolean {
    return !!affected.versions?.includes(depVersion);
  }

  private includedInRanges(
    depVersion: string,
    affected: Osv.Affected,
    versioningApi: VersioningApi,
  ): boolean {
    for (const range of affected.ranges ?? []) {
      if (range.type === 'GIT') {
        continue;
      }

      let vulnerable = false;
      for (const event of this.sortEvents(range.events, versioningApi)) {
        if (
          is.nonEmptyString(event.introduced) &&
          (event.introduced === '0' ||
            this.isVersionGtOrEq(depVersion, event.introduced, versioningApi))
        ) {
          vulnerable = true;
        } else if (
          is.nonEmptyString(event.fixed) &&
          this.isVersionGtOrEq(depVersion, event.fixed, versioningApi)
        ) {
          vulnerable = false;
        } else if (
          is.nonEmptyString(event.last_affected) &&
          this.isVersionGt(depVersion, event.last_affected, versioningApi)
        ) {
          vulnerable = false;
        }
      }

      if (vulnerable) {
        return true;
      }
    }

    return false;
  }

  // https://ossf.github.io/osv-schema/#evaluation
  private isPackageVulnerable(
    ecosystem: Ecosystem,
    packageName: string,
    depVersion: string,
    affected: Osv.Affected,
    versioningApi: VersioningApi,
  ): boolean {
    return (
      this.isPackageAffected(ecosystem, packageName, affected) &&
      (this.includedInVersions(depVersion, affected) ||
        this.includedInRanges(depVersion, affected, versioningApi))
    );
  }

  private getFixedVersion(
    ecosystem: Ecosystem,
    depVersion: string,
    affected: Osv.Affected,
    versioningApi: VersioningApi,
  ): string | null {
    const fixedVersions: string[] = [];
    const lastAffectedVersions: string[] = [];

    for (const range of affected.ranges ?? []) {
      if (range.type === 'GIT') {
        continue;
      }

      for (const event of range.events) {
        if (
          is.nonEmptyString(event.fixed) &&
          versioningApi.isVersion(event.fixed)
        ) {
          fixedVersions.push(event.fixed);
        } else if (
          is.nonEmptyString(event.last_affected) &&
          versioningApi.isVersion(event.last_affected)
        ) {
          lastAffectedVersions.push(event.last_affected);
        }
      }
    }

    fixedVersions.sort((a, b) => versioningApi.sortVersions(a, b));
    const fixedVersion = fixedVersions.find((version) =>
      this.isVersionGt(version, depVersion, versioningApi),
    );
    if (fixedVersion) {
      return ecosystem === 'PyPI' ? `==${fixedVersion}` : fixedVersion;
    }

    lastAffectedVersions.sort((a, b) => versioningApi.sortVersions(a, b));
    const lastAffected = lastAffectedVersions.find((version) =>
      this.isVersionGtOrEq(version, depVersion, versioningApi),
    );
    if (lastAffected) {
      return `> ${lastAffected}`;
    }

    return null;
  }

  private isVersionGt(
    version: string,
    other: string,
    versioningApi: VersioningApi,
  ): boolean {
    return (
      versioningApi.isVersion(version) &&
      versioningApi.isVersion(other) &&
      versioningApi.isGreaterThan(version, other)
    );
  }

  private isVersionGtOrEq(
    version: string,
    other: string,
    versioningApi: VersioningApi,
  ): boolean {
    return (
      versioningApi.isVersion(version) &&
      versioningApi.isVersion(other) &&
      (versioningApi.equals(version, other) ||
        versioningApi.isGreaterThan(version, other))
    );
  }

  private vulnerabilityToPackageRules(vul: Vulnerability): PackageRule | null {
    const {
      vulnerability,
      affected,
      packageName,
      depVersion,
      fixedVersion,
      datasource,
      packageFileConfig,
    } = vul;
    if (is.nullOrUndefined(fixedVersion)) {
      logger.info(
        `No fixed version available for vulnerability ${vulnerability.id} in ${packageName} ${depVersion}`,
      );
      return null;
    }

    logger.debug(
      `Setting allowed version ${fixedVersion} to fix vulnerability ${vulnerability.id} in ${packageName} ${depVersion}`,
    );

    const severityDetails = this.extractSeverityDetails(
      vulnerability,
      affected,
    );

    return {
      matchDatasources: [datasource],
      matchPackageNames: [packageName],
      matchCurrentVersion: depVersion,
      allowedVersions: fixedVersion,
      isVulnerabilityAlert: true,
      vulnerabilitySeverity: severityDetails.severityLevel,
      prBodyNotes: this.generatePrBodyNotes(vulnerability, affected),
      force: {
        ...packageFileConfig.vulnerabilityAlerts,
      },
    };
  }

  private evaluateCvssVector(vector: string): [string, string] {
    try {
      const parsedCvss: CvssScore = parseCvssVector(vector);
      const severityLevel = parsedCvss.cvss3OverallSeverityText;

      return [parsedCvss.baseScore.toFixed(1), severityLevel];
    } catch (err) {
      logger.debug(`Error processing CVSS vector ${vector}`);
    }

    return ['', ''];
  }

  private generatePrBodyNotes(
    vulnerability: Osv.Vulnerability,
    affected: Osv.Affected,
  ): string[] {
    let aliases = [vulnerability.id].concat(vulnerability.aliases ?? []).sort();
    aliases = aliases.map((id) => {
      if (id.startsWith('CVE-')) {
        return `[${id}](https://nvd.nist.gov/vuln/detail/${id})`;
      } else if (id.startsWith('GHSA-')) {
        return `[${id}](https://github.com/advisories/${id})`;
      } else if (id.startsWith('GO-')) {
        return `[${id}](https://pkg.go.dev/vuln/${id})`;
      } else if (id.startsWith('RUSTSEC-')) {
        return `[${id}](https://rustsec.org/advisories/${id}.html)`;
      }

      return id;
    });

    let content = '\n\n---\n\n### ';
    content += vulnerability.summary ? `${vulnerability.summary}\n` : '';
    content += `${aliases.join(' / ')}\n`;
    content += `\n<details>\n<summary>More information</summary>\n`;

    const details = vulnerability.details?.replace(
      regEx(/^#{1,4} /gm),
      '##### ',
    );
    content += `#### Details\n${details ?? 'No details.'}\n`;

    content += '#### Severity\n';
    const severityDetails = this.extractSeverityDetails(
      vulnerability,
      affected,
    );

    if (severityDetails.cvssVector) {
      content += `- CVSS Score: ${severityDetails.score}\n`;
      content += `- Vector String: \`${severityDetails.cvssVector}\`\n`;
    } else {
      content += `${titleCase(severityDetails.severityLevel)}\n`;
    }

    content += `\n#### References\n${
      vulnerability.references
        ?.map((ref) => {
          return `- [${ref.url}](${ref.url})`;
        })
        .join('\n') ?? 'No references.'
    }`;

    let attribution = '';
    if (vulnerability.id.startsWith('GHSA-')) {
      attribution = ` and the [GitHub Advisory Database](https://github.com/github/advisory-database) ([CC-BY 4.0](https://github.com/github/advisory-database/blob/main/LICENSE.md))`;
    } else if (vulnerability.id.startsWith('GO-')) {
      attribution = ` and the [Go Vulnerability Database](https://github.com/golang/vulndb) ([CC-BY 4.0](https://github.com/golang/vulndb#license))`;
    } else if (vulnerability.id.startsWith('PYSEC-')) {
      attribution = ` and the [PyPI Advisory Database](https://github.com/pypa/advisory-database) ([CC-BY 4.0](https://github.com/pypa/advisory-database/blob/main/LICENSE))`;
    } else if (vulnerability.id.startsWith('RUSTSEC-')) {
      attribution = ` and the [Rust Advisory Database](https://github.com/RustSec/advisory-db) ([CC0 1.0](https://github.com/rustsec/advisory-db/blob/main/LICENSE.txt))`;
    }
    content += `\n\nThis data is provided by [OSV](https://osv.dev/vulnerability/${vulnerability.id})${attribution}.\n`;
    content += `</details>`;

    return [sanitizeMarkdown(content)];
  }

  private extractSeverityDetails(
    vulnerability: Osv.Vulnerability,
    affected: Osv.Affected,
  ): SeverityDetails {
    let severityLevel = 'UNKNOWN';
    let score = 'Unknown';

    const cvssVector =
      vulnerability.severity?.find((e) => e.type === 'CVSS_V3')?.score ??
      vulnerability.severity?.[0]?.score ??
      (affected.database_specific?.cvss as string); // RUSTSEC

    if (cvssVector) {
      const [baseScore, severity] = this.evaluateCvssVector(cvssVector);
      severityLevel = severity.toUpperCase();
      score = baseScore
        ? `${baseScore} / 10 (${titleCase(severityLevel)})`
        : 'Unknown';
    } else if (
      vulnerability.id.startsWith('GHSA-') &&
      vulnerability.database_specific?.severity
    ) {
      const severity = vulnerability.database_specific.severity as string;
      severityLevel = severity.toUpperCase();
    }

    return {
      cvssVector,
      score,
      severityLevel,
    };
  }
}
