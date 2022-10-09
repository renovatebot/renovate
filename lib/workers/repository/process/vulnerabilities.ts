// TODO #7154
import { Ecosystem, Osv, OsvOffline } from '@renovatebot/osv-offline';
import is from '@sindresorhus/is';
import { getManagerConfig, mergeChildConfig } from '../../../config';
import type { PackageRule, RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import type {
  PackageDependency,
  PackageFile,
} from '../../../modules/manager/types';
import semverCoerced from '../../../modules/versioning/semver-coerced';
import * as p from '../../../util/promises';

export class Vulnerabilities {
  private osvOffline: OsvOffline | undefined;

  private static readonly datasourceEcosystemMap: Record<
    string,
    Ecosystem | undefined
  > = {
    crate: 'crates.io',
    go: 'Go',
    maven: 'Maven',
    npm: 'npm',
    nuget: 'NuGet',
    pypi: 'PyPI',
    rubygems: 'RubyGems',
  };

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  private async initialize(): Promise<void> {
    this.osvOffline = await OsvOffline.create();
  }

  static async create(): Promise<Vulnerabilities> {
    const instance = new Vulnerabilities();
    await instance.initialize();
    return instance;
  }

  async fetchVulnerabilities(
    config: RenovateConfig,
    packageFiles: Record<string, PackageFile[]>
  ): Promise<void> {
    const managers = Object.keys(packageFiles);
    const allManagerJobs = managers.map((manager) =>
      this.fetchManagerVulnerabilities(config, packageFiles, manager)
    );
    await Promise.all(allManagerJobs);
  }

  private async fetchManagerVulnerabilities(
    config: RenovateConfig,
    packageFiles: Record<string, PackageFile[]>,
    manager: string
  ): Promise<void> {
    const managerConfig = getManagerConfig(config, manager);
    const queue = packageFiles[manager].map(
      (pFile) => (): Promise<void> =>
        this.fetchManagerPackageFileVulnerabilities(
          config,
          managerConfig,
          pFile
        )
    );
    logger.trace(
      { manager, queueLength: queue.length },
      'fetchManagerUpdates starting'
    );
    await p.all(queue);
    logger.trace({ manager }, 'fetchManagerUpdates finished');
  }

  private async fetchManagerPackageFileVulnerabilities(
    config: RenovateConfig,
    managerConfig: RenovateConfig,
    pFile: PackageFile
  ): Promise<void> {
    const { packageFile } = pFile;
    const packageFileConfig = mergeChildConfig(managerConfig, pFile);
    const { manager } = packageFileConfig;
    const queue = pFile.deps.map(
      (dep) => (): Promise<PackageRule[]> =>
        this.fetchDependencyVulnerabilities(packageFileConfig, dep)
    );
    logger.trace(
      { manager, packageFile, queueLength: queue.length },
      'fetchManagerPackageFileVulnerabilities starting with concurrency'
    );

    config.packageRules?.push(...(await p.all(queue)).flat());
    logger.trace(
      { packageFile },
      'fetchManagerPackageFileVulnerabilities finished'
    );
  }

  private async fetchDependencyVulnerabilities(
    packageFileConfig: RenovateConfig & PackageFile,
    packageDependency: PackageDependency
  ): Promise<PackageRule[]> {
    const ecosystem =
      Vulnerabilities.datasourceEcosystemMap[packageDependency.datasource!];
    if (!ecosystem) {
      return [];
    }

    let vulnerabilities = await this.osvOffline?.getVulnerabilities(
      ecosystem,
      packageDependency.depName!
    );
    if (is.nullOrUndefined(vulnerabilities) || is.emptyArray(vulnerabilities)) {
      return [];
    }
    vulnerabilities = this.filterVulnerabilities(
      vulnerabilities,
      packageDependency
    );
    return this.convertToPackageRule(
      packageFileConfig,
      vulnerabilities ?? [],
      packageDependency.depName!,
      ecosystem
    );
  }

  private filterVulnerabilities(
    vulnerabilities: Osv.Vulnerability[],
    packageDependency: PackageDependency
  ): Osv.Vulnerability[] {
    return vulnerabilities.filter((vulnerability) => {
      return vulnerability.affected?.some((affected) => {
        return (
          affected.package?.ecosystem ===
            Vulnerabilities.datasourceEcosystemMap[
              packageDependency.datasource!
            ] &&
          affected.package?.name === packageDependency.depName &&
          affected.ranges?.some(
            (range) =>
              semverCoerced.isGreaterThan(
                packageDependency.currentValue!,
                range.events.find((event) =>
                  is.nonEmptyString(event.introduced)
                )?.introduced ?? ''
              ) &&
              semverCoerced.isGreaterThan(
                range.events.find((event) => is.nonEmptyString(event.fixed))
                  ?.fixed ?? '',
                packageDependency.currentValue!
              )
          )
        );
      });
    });
  }

  private convertToPackageRule(
    packageFileConfig: RenovateConfig & PackageFile,
    vulnerabilities: Osv.Vulnerability[],
    dependencyName: string,
    ecosystem: Ecosystem
  ): PackageRule[] {
    const rules: PackageRule[] = [];

    vulnerabilities.forEach((vulnerability) => {
      vulnerability.affected?.forEach((affected) => {
        if (
          affected.package?.ecosystem === ecosystem &&
          affected.package.name === dependencyName
        ) {
          rules.push({
            matchPackageNames: [dependencyName],
            // TODO: Multiple ranges
            allowedVersions: affected?.ranges?.[0].events.find((event) =>
              is.nonEmptyString(event.fixed)
            )!.fixed,
            isVulnerabilityAlert: true,
            prBodyNotes: Vulnerabilities.generatePrBodyNotes(
              dependencyName,
              vulnerability
            ),
            force: {
              ...packageFileConfig.vulnerabilityAlerts,
            },
          });
        }
      });
    });

    return rules;
  }

  private static generatePrBodyNotes(
    dependencyName: string,
    vulnerability: Osv.Vulnerability
  ): string[] {
    return [
      `## ${dependencyName} - ${vulnerability.id}`,
      `${vulnerability.summary ?? ''}`,
      '<details><summary>More information</summary>',
      `## Details\n${vulnerability.details ?? 'No details'}
## Severity\n${vulnerability.severity?.[0].score ?? 'No severity'}
## References\n${
        vulnerability.references
          ?.map((ref) => {
            return `- ${ref.url}`;
          })
          .join('\n') ?? 'No references'
      }</details>`,
    ];
  }
}
