import { z } from 'zod/v3';
import type { SkipReason } from '../../../../types/index.ts';
import { CrateDatasource } from '../../../datasource/crate/index.ts';
import type { CargoManagerData } from '../../cargo/types.ts';
import type { PackageDependency } from '../../types.ts';
import { applyGitSource } from '../../util.ts';
import { ExtensionTagFragment, StringFragment } from './fragments.ts';

export const crateExtensionPrefix = 'crate';

const specTag = 'spec';

export const crateExtensionTags = [specTag];

export const RuleToCratePackageDep = ExtensionTagFragment.extend({
  extension: z.literal(crateExtensionPrefix),
  tag: z.literal(specTag),
  children: z.object({
    /** Git branch for the dependency */
    branch: StringFragment.optional(),
    /** Git URL for the dependency */
    git: StringFragment.optional(),
    /** Name of a package to look up */
    package: StringFragment,
    /** Path on disk to the crate sources */
    path: StringFragment.optional(),
    /** Git revision for the dependency */
    rev: StringFragment.optional(),
    /** Git tag for the dependency */
    tag: StringFragment.optional(),
    /** Semver version */
    version: StringFragment.optional(),
  }),
}).transform(
  ({
    children: { package: packageName, version, git, rev, tag, branch, path },
  }): PackageDependency => {
    let skipReason: SkipReason | undefined;
    let currentValue: string;
    let nestedVersion = false;

    if (version?.value) {
      currentValue = version.value;
      nestedVersion = true;
    } else {
      currentValue = '';
    }

    const dep: PackageDependency<CargoManagerData> = {
      datasource: CrateDatasource.id,
      depName: packageName.value,
      currentValue,
      depType: 'crate_spec',
      managerData: { nestedVersion },
    };

    if (path) {
      skipReason = 'path-dependency';
    } else if (git?.value) {
      applyGitSource(dep, git.value, rev?.value, tag?.value, branch?.value);
    } else if (!version) {
      skipReason = 'invalid-dependency-specification';
    }

    if (skipReason) {
      dep.skipReason = skipReason;
    }

    return dep;
  },
);
