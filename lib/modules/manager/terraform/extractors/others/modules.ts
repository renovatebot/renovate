import { isNullOrUndefined, isPlainObject } from '@sindresorhus/is';
import { logger } from '../../../../../logger/index.ts';
import { isOCIRegistry } from '../../../helmv3/oci.ts';
import type { ExtractConfig, PackageDependency } from '../../../types.ts';
import { DependencyExtractor } from '../../base.ts';
import type { TerraformDefinitionFile } from '../../hcl/types.ts';
import type { ProviderLock } from '../../lockfile/types.ts';
import {
  analyseModuleSource,
  matchTerraformGitSource,
} from '../../module-source.ts';
import { applyOciDependency } from '../../util.ts';

export class ModuleExtractor extends DependencyExtractor {
  getCheckList(): string[] {
    return ['module'];
  }

  extract(
    hclRoot: TerraformDefinitionFile,
    _locks: ProviderLock[],
    config: ExtractConfig,
  ): PackageDependency[] {
    const modules = hclRoot.module;
    if (isNullOrUndefined(modules)) {
      return [];
    }

    /* v8 ignore next -- needs test */
    if (!isPlainObject(modules)) {
      logger.debug({ modules }, 'Terraform: unexpected `modules` value');
      return [];
    }

    const dependencies = [];
    for (const [depName, moduleElements] of Object.entries(modules)) {
      for (const moduleElement of moduleElements) {
        const dep = {
          depName,
          depType: 'module',
          currentValue: moduleElement.version,
          managerData: {
            source: moduleElement.source,
          },
        };
        dependencies.push(this.analyseTerraformModule(dep, config));
      }
    }

    return dependencies;
  }

  private analyseTerraformModule(
    dep: PackageDependency,
    config: ExtractConfig,
  ): PackageDependency {
    // TODO #22198
    const source = dep.managerData!.source as string;

    if (isOCIRegistry(source)) {
      applyOciDependency(dep, source, config.registryAliases);
      return dep;
    }

    analyseModuleSource(dep, source, {
      manager: 'terraform',
      matchGitSource: matchTerraformGitSource,
    });

    return dep;
  }
}
