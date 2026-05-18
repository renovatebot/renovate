import { miseTooling, parsedMiseRegistry } from './upgradeable-tooling.ts';

describe('modules/manager/mise/upgradeable-tooling', () => {
  describe('supported tools', () => {
    it('should stay in sync with the mise registry', () => {
      // currently supported
      const allShortToolNames = new Set([
        ...Object.keys(miseTooling),
        // included in both, as it's the current set of supported
        ...Object.keys(parsedMiseRegistry),
      ]);

      const miseRegistrySupported = new Set(Object.keys(parsedMiseRegistry));

      expect(
        allShortToolNames,
        'Renovate should not support updating any short tool names that are not supported upstream by mise',
      ).toEqual(miseRegistrySupported);
    });
  });
});
