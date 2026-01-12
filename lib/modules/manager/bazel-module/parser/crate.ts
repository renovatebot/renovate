import { z } from 'zod';
import type { SkipReason } from '../../../../types';
import { CrateDatasource } from '../../../datasource/crate';
import type { CargoManagerData } from '../../cargo/types';
import type { PackageDependency } from '../../types';
import { applyGitSource } from '../../util';
import { ExtensionTagFragment, StringFragment } from './fragments';

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
      versioning: 'semver',
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
