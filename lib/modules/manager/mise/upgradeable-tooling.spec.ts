import { dequal } from 'dequal';
import type { ToolingConfig } from '../asdf/types.ts';
import { asdfTooling, miseTooling } from './upgradeable-tooling.ts';

/**
 * mise short names that resolve via a differently named asdf plugin. Entries
 * here must reuse the asdf config instead of re-declaring it.
 */
const asdfAliases: Record<string, string> = {
  go: 'golang',
  node: 'nodejs',
};

const sharedNames: [string, ToolingConfig, ToolingConfig][] = Object.keys(
  miseTooling,
)
  .map((name) => [name, asdfTooling[asdfAliases[name] ?? name]] as const)
  .filter(([, asdfDefinition]) => !!asdfDefinition)
  .map(([name, asdfDefinition]) => [
    name,
    miseTooling[name].config,
    asdfDefinition.config,
  ]);

describe('modules/manager/mise/upgradeable-tooling', () => {
  it('reuses asdf configs instead of re-declaring them', () => {
    // A mise entry may keep its own config, but only when it genuinely differs
    // from the asdf one. Identical copies drift apart, so they must be shared.
    const duplicated = sharedNames
      .filter(
        ([, miseConfig, asdfConfig]) =>
          miseConfig !== asdfConfig && dequal(miseConfig, asdfConfig),
      )
      .map(([name]) => name);

    expect(duplicated).toEqual([]);
  });
});
