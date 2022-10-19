// TODO #7154
import { Ecosystem, Osv, OsvOffline } from '@renovatebot/osv-offline';
import { getManagerConfig, mergeChildConfig } from '../../../config';
import type { PackageRule, RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import type {
  PackageDependency,
  PackageFile,
} from '../../../modules/manager/types';
import * as p from '../../../util/promises';

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
    await p.all(queue);
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

    config.packageRules?.push(...(await p.all(queue)).flat());
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
      vulnerabilities ?? [],
      packageDependency.depName!,
      ecosystem!
    );
  }

  private convertToPackageRule(
    vulnerabilities: Osv.Vulnerability[],
    dependencyName: string,
    ecosystem: Ecosystem
  ): PackageRule[] {
    return vulnerabilities
      .flatMap((vulnerability) => vulnerability.affected)
      .filter(
        (vulnerability) =>
          vulnerability?.package?.name === dependencyName &&
          vulnerability?.package?.ecosystem === ecosystem
      )
      .map(
        (affected): PackageRule => ({
          matchPackageNames: [dependencyName],
          allowedVersions: affected?.ranges?.[0].events.find(
            (event) => event.fixed !== undefined
          )!.fixed,
          isVulnerabilityAlert: true,
        })
      );
  }
}
