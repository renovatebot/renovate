import { isNullOrUndefined, isPlainObject, isString } from '@sindresorhus/is';
import { logger } from '../../../../../logger/index.ts';
import { coerceArray } from '../../../../../util/array.ts';
import { regEx } from '../../../../../util/regex.ts';
import { BitbucketTagsDatasource } from '../../../../datasource/bitbucket-tags/index.ts';
import { GitTagsDatasource } from '../../../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../../../datasource/github-tags/index.ts';
import { TerraformModuleDatasource } from '../../../../datasource/terraform-module/index.ts';
import { isOCIRegistry } from '../../../helmv3/oci.ts';
import type { ExtractConfig, PackageDependency } from '../../../types.ts';
import { DependencyExtractor } from '../../base.ts';
import type { TerraformDefinitionFile } from '../../hcl/types.ts';
import type { ProviderLock } from '../../lockfile/types.ts';
import type { TerraformManagerData } from '../../types.ts';
import { applyOciDependency } from '../../util.ts';

export const githubRefMatchRegex = regEx(
  /github\.com(?:[/:])(?<project>[^/]+\/[a-z0-9-_.]+).*\?(?:depth=\d+&)?ref=(?<tag>.*?)(?:&depth=\d+)?$/i,
);
export const bitbucketRefMatchRegex = regEx(
  /(?:git::)?(?<url>(?:http|https|ssh)?(?::\/\/)?(?:.*@)?(?<path>bitbucket\.org\/(?<workspace>.*)\/(?<project>.*)\.git\/?(?<subfolder>.*)))\?(?:depth=\d+&)?ref=(?<tag>.*?)(?:&depth=\d+)?$/,
);
export const gitTagsRefMatchRegex = regEx(
  /(?:git::)?(?<url>(?:(?:http|https|ssh):\/\/)?(?:.*@)?(?<path>[^:/]+[:/](?<project>[^/]+(?:\/[^/]+)*))(?:\.git)?)(?:(?:\/\/)?(?<subfolder>[^?]*))?\?(?:depth=\d+&)?ref=(?<tag>.*?)(?:&depth=\d+)?$/,
);
export const azureDevOpsSshRefMatchRegex = regEx(
  /(?:git::)?(?<url>git@ssh\.dev\.azure\.com:v3\/(?<organization>[^/]*)\/(?<project>[^/]*)\/(?<repository>[^/]*))(?<modulepath>.*)?\?(?:depth=\d+&)?ref=(?<tag>.*?)(?:&depth=\d+)?$/,
);

export const hostnameMatchRegex = regEx(
  /^(?<hostname>[a-zA-Z\d](?:[a-zA-Z\d-]*\.)+[a-zA-Z\d]+)/,
);

// Terraform 1.15+ allows a `local` or (`const`) `variable` reference to be used
// as the whole value of a module's `source`/`version` ref, e.g. `${local.tag}`
// or `${var.tag}`. This regex matches that entire reference so the underlying
// local/variable value can be resolved and tracked by Renovate instead.
const localOrVariableRefRegex = regEx(
  /^\$\{\s*(?<kind>local|var)\.(?<name>[a-zA-Z_][a-zA-Z0-9_-]*)\s*\}$/,
);

interface Reference {
  kind: 'local' | 'var';
  name: string;
}

type ModuleDependency = PackageDependency<TerraformManagerData>;

function parseReference(value: string): Reference | null {
  const match = localOrVariableRefRegex.exec(value);
  if (!match?.groups) {
    return null;
  }
  return {
    kind: match.groups.kind as Reference['kind'],
    name: match.groups.name,
  };
}

function referenceKey({ kind, name }: Reference): string {
  return `${kind}.${name}`;
}

function isDeclared(
  { kind, name }: Reference,
  hclRoot: TerraformDefinitionFile,
): boolean {
  if (kind === 'local') {
    return coerceArray(hclRoot.locals).some((block) =>
      Object.hasOwn(block, name),
    );
  }
  return (
    !!hclRoot.variable &&
    Object.hasOwn(hclRoot.variable, name) &&
    coerceArray(hclRoot.variable[name]).length > 0
  );
}

/**
 * Resolves a `${local.x}` or `${var.x}` reference to its underlying string
 * value, if the value can be statically determined (i.e. a `locals` value or
 * a `variable` block with a string `default`).
 */
function resolveLocalOrVariableValue(
  { kind, name }: Reference,
  hclRoot: TerraformDefinitionFile,
): string | undefined {
  if (!isDeclared({ kind, name }, hclRoot)) {
    return undefined;
  }

  if (kind === 'local') {
    for (const localsBlock of coerceArray(hclRoot.locals)) {
      const localValue = localsBlock[name];
      if (isString(localValue)) {
        return localValue;
      }
    }
    return undefined;
  }

  for (const variableBlock of coerceArray(hclRoot.variable?.[name])) {
    if (isString(variableBlock.default)) {
      return variableBlock.default;
    }
  }
  return undefined;
}

// A chained reference such as `tag = local.base` resolves to `${local.base}`
function isStaticValue(value: string | undefined): value is string {
  return isString(value) && !value.includes('${');
}

export class ModuleExtractor extends DependencyExtractor {
  getCheckList(): string[] {
    return ['module'];
  }

  /**
   * @param siblings parsed contents of the other Terraform files in the same
   * directory. Modules in these files which reference a `local`/`variable`
   * declared in `hclRoot` are reported against `hclRoot`, as that is the file
   * which has to be updated.
   */
  extract(
    hclRoot: TerraformDefinitionFile,
    _locks: ProviderLock[],
    config: ExtractConfig,
    siblings: TerraformDefinitionFile[] = [],
  ): PackageDependency[] {
    const dependencies: PackageDependency[] = [];
    const refUsers = new Map<string, PackageDependency[]>();

    for (const dep of this.analyseModules(hclRoot, config)) {
      this.resolveOwnReference(dep, hclRoot, refUsers);
      dependencies.push(dep);
    }

    for (const sibling of siblings) {
      for (const dep of this.analyseModules(sibling, config)) {
        if (this.resolveSiblingReference(dep, sibling, hclRoot, refUsers)) {
          dependencies.push(dep);
        }
      }
    }

    // A shared declaration is rewritten by every update, so it must not feed
    // modules from different repositories (or different registry modules).
    for (const users of refUsers.values()) {
      const packages = new Set(users.map((u) => u.packageName ?? u.depName));
      if (packages.size > 1) {
        for (const user of users) {
          user.skipReason = 'contains-variable';
        }
      }
    }

    return dependencies;
  }

  private analyseModules(
    hclRoot: TerraformDefinitionFile,
    config: ExtractConfig,
  ): ModuleDependency[] {
    const modules = hclRoot.module;
    if (isNullOrUndefined(modules)) {
      return [];
    }

    /* v8 ignore next -- needs test */
    if (!isPlainObject(modules)) {
      logger.debug({ modules }, 'Terraform: unexpected `modules` value');
      return [];
    }

    const dependencies: ModuleDependency[] = [];
    for (const [depName, moduleElements] of Object.entries(modules)) {
      for (const moduleElement of moduleElements) {
        const dep: ModuleDependency = {
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

  private getReference(dep: ModuleDependency): Reference | null {
    // `tag`/`digest` of OCI modules are not resolved; a module without
    // `source` has a skip reason, so `source` is set past that check
    if (
      !isString(dep.currentValue) ||
      dep.skipReason ||
      isOCIRegistry(dep.managerData!.source)
    ) {
      return null;
    }
    return parseReference(dep.currentValue);
  }

  private trackReference(
    dep: ModuleDependency,
    ref: Reference,
    value: string,
    refUsers: Map<string, PackageDependency[]>,
  ): void {
    const key = referenceKey(ref);
    refUsers.set(key, [...coerceArray(refUsers.get(key)), dep]);
    dep.currentValue = value;
  }

  /**
   * Resolves the reference of a module using only the declarations of its own
   * file. A reference which cannot be resolved here is skipped; if the
   * declaration lives in another file it is reported against that file.
   */
  private resolveOwnReference(
    dep: ModuleDependency,
    hclRoot: TerraformDefinitionFile,
    refUsers: Map<string, PackageDependency[]>,
  ): void {
    const ref = this.getReference(dep);
    if (!ref) {
      return;
    }
    const value = resolveLocalOrVariableValue(ref, hclRoot);
    if (isStaticValue(value)) {
      this.trackReference(dep, ref, value, refUsers);
      return;
    }
    logger.debug(
      { dep },
      'Terraform: unable to resolve local/variable reference used as module ref/version',
    );
    dep.skipReason = 'contains-variable';
  }

  /**
   * Resolves the reference of a module of a sibling file against the
   * declarations of `hclRoot`. Returns `false` if the module is not relevant
   * for `hclRoot`.
   */
  private resolveSiblingReference(
    dep: ModuleDependency,
    sibling: TerraformDefinitionFile,
    hclRoot: TerraformDefinitionFile,
    refUsers: Map<string, PackageDependency[]>,
  ): boolean {
    const ref = this.getReference(dep);
    // a declaration of the sibling itself wins, it is reported for the sibling
    if (!ref || isDeclared(ref, sibling)) {
      return false;
    }
    const value = resolveLocalOrVariableValue(ref, hclRoot);
    if (!isStaticValue(value)) {
      return false;
    }
    this.trackReference(dep, ref, value, refUsers);
    return true;
  }

  private analyseTerraformModule(
    dep: ModuleDependency,
    config: ExtractConfig,
  ): ModuleDependency {
    // TODO #22198
    const source = dep.managerData!.source!;

    if (isOCIRegistry(source)) {
      applyOciDependency(dep, source, config.registryAliases);
      return dep;
    }

    const githubRefMatch = githubRefMatchRegex.exec(source);
    const bitbucketRefMatch = bitbucketRefMatchRegex.exec(source);
    const gitTagsRefMatch = gitTagsRefMatchRegex.exec(source);
    const azureDevOpsSshRefMatch = azureDevOpsSshRefMatchRegex.exec(source);

    if (githubRefMatch?.groups) {
      dep.packageName = githubRefMatch.groups.project.replace(
        regEx(/\.git$/),
        '',
      );
      dep.depName = `github.com/${dep.packageName}`;
      dep.currentValue = githubRefMatch.groups.tag;
      dep.datasource = GithubTagsDatasource.id;
    } else if (bitbucketRefMatch?.groups) {
      dep.depName = `${bitbucketRefMatch.groups.workspace}/${bitbucketRefMatch.groups.project}`;
      dep.packageName = dep.depName;
      dep.currentValue = bitbucketRefMatch.groups.tag;
      dep.datasource = BitbucketTagsDatasource.id;
    } else if (azureDevOpsSshRefMatch?.groups) {
      dep.depName = `${azureDevOpsSshRefMatch.groups.organization}/${azureDevOpsSshRefMatch.groups.project}/${azureDevOpsSshRefMatch.groups.repository}${azureDevOpsSshRefMatch.groups.modulepath}`;
      dep.packageName = azureDevOpsSshRefMatch.groups.url;
      dep.currentValue = azureDevOpsSshRefMatch.groups.tag;
      dep.datasource = GitTagsDatasource.id;
    } else if (gitTagsRefMatch?.groups) {
      if (gitTagsRefMatch.groups.subfolder) {
        logger.debug('Terraform module contains subdirectory');
      }
      dep.depName = gitTagsRefMatch.groups.path.replace(regEx(/\.git$/), '');
      dep.packageName = gitTagsRefMatch.groups.url.replace(regEx(/\.git$/), '');
      dep.currentValue = gitTagsRefMatch.groups.tag;
      dep.datasource = GitTagsDatasource.id;
    } else if (source) {
      const moduleParts = source.split('//')[0].split('/');
      if (moduleParts[0] === '.' || moduleParts[0] === '..') {
        dep.skipReason = 'local';
      } else if (moduleParts.length >= 3) {
        const hostnameMatch = hostnameMatchRegex.exec(source);
        if (hostnameMatch?.groups) {
          dep.registryUrls = [`https://${hostnameMatch.groups.hostname}`];
        }
        dep.depName = moduleParts.join('/');
        dep.datasource = TerraformModuleDatasource.id;
      }
    } else {
      logger.debug({ dep }, 'terraform dep has no source');
      dep.skipReason = 'no-source';
    }

    return dep;
  }
}
