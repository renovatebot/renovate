import { AllManagersListLiteral } from '../../manager-list.generated.ts';
import { coerceArray } from '../../util/array.ts';
import type { AllowedParents, ConfigScope, RenovateOptions } from '../types.ts';
import { UpdateTypesOptions, configScopes } from '../types.ts';

const scopeDescriptions: Record<ConfigScope, string> = {
  repo: 'at the top level of a config',
  packageRule: 'in a `packageRules` entry',
  manager: "in a manager's config",
  updateType: "in an update type's config",
  vulnerabilityAlert: 'in `vulnerabilityAlerts`',
  group: 'in `group`',
};

const scopeParents: Record<ConfigScope, readonly AllowedParents[]> = {
  repo: ['.'],
  packageRule: ['packageRules'],
  manager: AllManagersListLiteral,
  updateType: UpdateTypesOptions,
  vulnerabilityAlert: ['vulnerabilityAlerts'],
  group: ['group'],
};

/**
 * The scopes of an option which is honoured wherever per-update config is applied, which is most of our options.
 */
export const sharedScopes: ConfigScope[] = [
  'repo',
  'packageRule',
  'manager',
  'updateType',
  'vulnerabilityAlert',
  'group',
];

/**
 * The scopes of an option which is honoured when we look up a dependency's updates.
 *
 * That happens before we know an update's type, and before a group's config is merged in, so an option which shapes the updates we find isn't honoured in either.
 */
export const lookupScopes: ConfigScope[] = [
  'repo',
  'packageRule',
  'manager',
  'vulnerabilityAlert',
];

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

/**
 * A description of everywhere an option can be used, for telling someone where they can move it to.
 *
 * Returns `undefined` for an option which can be used anywhere.
 */
export function describeAllowedLocations(
  option: RenovateOptions,
): string | undefined {
  if (!getAllowedParents(option)) {
    return undefined;
  }

  const scopes = new Set(coerceArray(option.scopes));
  if (option.parents?.includes('.')) {
    scopes.add('repo');
  }

  const locations = configScopes
    .filter((scope) => scopes.has(scope))
    .map((scope) => scopeDescriptions[scope]);

  const parents = coerceArray(option.parents)
    .filter((parent) => parent !== '.')
    .toSorted();
  if (parents.length) {
    locations.push(
      `in ${joinWithOr(parents.map((parent) => `\`${parent}\``))}`,
    );
  }

  return joinWithOr(locations);
}

function joinWithOr(parts: string[]): string {
  if (parts.length < 2) {
    return parts.join('');
  }

  return `${parts.slice(0, -1).join(', ')} or ${parts.at(-1)}`;
}
