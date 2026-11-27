import { getManagers } from '../../../modules/manager/index.ts';
import { presets } from './default.preset.ts';

describe('config/presets/internal/default.preset', () => {
  describe('semanticPrefixFixDepsChoreOthers', () => {
    const fixRules =
      presets.semanticPrefixFixDepsChoreOthers.packageRules!.filter(
        (rule) =>
          rule.semanticCommitType === 'fix' &&
          rule.matchManagers &&
          rule.matchDepTypes,
      );

    it.each(
      fixRules.flatMap((rule) =>
        rule.matchManagers!.flatMap((manager) =>
          rule.matchDepTypes!.map((depType) => [manager, depType]),
        ),
      ),
    )('only matches known depTypes: %s %s', (manager, depType) => {
      const knownDepTypes = getManagers().get(manager)?.knownDepTypes;
      expect(knownDepTypes?.map((meta) => meta.depType)).toContain(depType);
    });
  });
});
