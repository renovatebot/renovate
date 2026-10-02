import { AllManagersListLiteral } from '../../manager-list.generated.ts';
import { coerceArray } from '../../util/array.ts';
import type { AllowedParents, ConfigScope, RenovateOptions } from '../types.ts';
import { UpdateTypesOptions } from '../types.ts';

const scopeParents: Record<ConfigScope, readonly AllowedParents[]> = {
  repo: ['.'],
  packageRule: ['packageRules'],
  manager: AllManagersListLiteral,
  updateType: UpdateTypesOptions,
};

/**
 * Every object an option can be used in, from the objects it names in `parents` and the kinds of place it names in `scopes`.
 *
 * Returns `undefined` for an option which declares neither, which we treat as being valid anywhere until it's been given its scopes as part of #43020.
 */
export function getAllowedParents(
  option: RenovateOptions,
): AllowedParents[] | undefined {
  if (!option.parents && !option.scopes) {
    return undefined;
  }

  const parents = new Set<AllowedParents>(option.parents);
  for (const scope of coerceArray(option.scopes)) {
    for (const parent of scopeParents[scope]) {
      parents.add(parent);
    }
  }

  return [...parents];
}
