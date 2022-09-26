// TODO #7154
import { Ecosystem, Osv, OsvOffline } from '@jamiemagee/osv-offline';
import pAll from 'p-all';
import { getManagerConfig, mergeChildConfig } from '../../../config';
import type { PackageRule, RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import type {
  PackageDependency,
  PackageFile,
} from '../../../modules/manager/types';

export class Vulnerabilities {
  private osvOffline: OsvOffline | undefined;

  private static readonly managerEcosystemMap: Record<
    string,
    Ecosystem | undefined
  > = {
    bundler: 'RubyGems',
    cargo: 'crates.io',
    gomod: 'Go',
    gradle: 'Maven',
    maven: 'Maven',
    meteor: 'npm',
    npm: 'npm',
    nuget: 'NuGet',
    'pip-compile': 'PyPI',
    pip_requirements: 'PyPI',
    pip_setup: 'PyPI',
    pipenv: 'PyPI',
    poetry: 'PyPI',
    'setup-cfg': 'PyPI',
    sbt: 'Maven',
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
    const managers = Object.keys(packageFiles).filter(
      (manager) => Vulnerabilities.managerEcosystemMap[manager] !== undefined
    );
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
        this.fetchManagerPackagerFileUpdates(config, managerConfig, pFile)
    );
    logger.trace(
      { manager, queueLength: queue.length },
      'fetchManagerUpdates starting'
    );
    await pAll(queue, { concurrency: 5 });
    logger.trace({ manager }, 'fetchManagerUpdates finished');
  }

  private async fetchManagerPackagerFileUpdates(
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
      'fetchManagerPackagerFileUpdates starting with concurrency'
    );

    config.packageRules?.push(
      ...(await pAll(queue, { concurrency: 5 })).flat()
    );
    logger.trace({ packageFile }, 'fetchManagerPackagerFileUpdates finished');
  }

  private async fetchDependencyVulnerabilities(
    packageFileConfig: RenovateConfig & PackageFile,
    packageDependency: PackageDependency
  ): Promise<PackageRule[]> {
    const ecosystem =
      Vulnerabilities.managerEcosystemMap[packageFileConfig.manager!];

    const vulnerabilities = await this.osvOffline?.getVulnerabilities(
      ecosystem!,
      packageDependency.depName!
    );
    return this.convertToPackageRule(
      packageFileConfig,
      vulnerabilities ?? [],
      packageDependency.depName!,
      ecosystem!
    );
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
          const prBodyNotes: string[] = [
            `## ${affected.package.name} - ${vulnerability.id}`,
            `${vulnerability.summary ?? ''}`,
            `<details><summary>More infos</summary>

## Details\n${vulnerability.details ?? 'No details'}

## Severity\n${vulnerability.severity?.[0].score ?? 'No severity'}

## References\n${
              vulnerability.references
                ?.map((ref) => {
                  return ref.url;
                })
                .join('\n') ?? 'No references'
            }</details>`,
          ];
          rules.push({
            matchPackageNames: [dependencyName],
            allowedVersions: affected?.ranges?.[0].events.find(
              (event) => event.fixed !== undefined
            )!.fixed,
            isVulnerabilityAlert: true,
            prBodyNotes: prBodyNotes,
            force: {
              ...packageFileConfig.vulnerabilityAlerts,
            },
          });
        }
      });
    });
    return rules;
  }
}
