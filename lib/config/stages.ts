import type { OptionDefinition } from './options/index.ts';
import type { RenovateConfigStage, RenovateOptions } from './types.ts';

/**
 * The stages of the options, in the order in which Renovate applies them.
 */
const stages = [
  'global',
  'inherit',
  'repository',
  'package',
  'branch',
  'pr',
] as const satisfies readonly RenovateConfigStage[];

type StagesBefore<
  S extends RenovateConfigStage,
  T extends readonly RenovateConfigStage[] = typeof stages,
> = T extends readonly [
  infer First extends RenovateConfigStage,
  ...infer Rest extends RenovateConfigStage[],
]
  ? First extends S
    ? never
    : First | StagesBefore<S, Rest>
  : never;

/**
 * The options which `filterConfig()` deletes from a config for the stage `S`, which are those of an earlier stage.
 *
 * The generated manager options aren't included, as their names aren't known to the type system.
 */
export type FilteredConfigKey<S extends RenovateConfigStage> = Extract<
  OptionDefinition,
  { stage: StagesBefore<S> }
>['name'];

/**
 * Whether an option is one of the {@link FilteredConfigKey} of a stage, which is when its own stage comes earlier.
 */
export function isFilteredOption(
  option: RenovateOptions,
  targetStage: RenovateConfigStage,
): boolean {
  if (!option.stage) {
    return false;
  }

  return stages.indexOf(option.stage) < stages.indexOf(targetStage);
}
