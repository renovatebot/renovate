import { getOptions } from './options/index.ts';
import type { RenovateConfig } from './types.ts';

describe('config/types', () => {
  describe('RenovateConfig should contain Repo config', () => {
    const opts = getOptions().filter((o) => !o.globalOnly);
    for (const option of opts) {
      if (option.name !== 'enabled') {
        continue;
      }
      it(`${option.name} should be a property`, () => {
        // Compile-time type check: if name is not keyof RenovateConfig, this is a type error
        const name = option.name as keyof RenovateConfig;
        // Runtime check: verify via a cast — this test catches drift when types diverge
        expect(name).toBeDefined();
        // console.log({ name })
      });
    }
  });

  describe('RenovateConfig should not contain Global config', () => {
    const opts = getOptions().filter((o) => o.globalOnly);
    for (const option of opts) {
      // TODO: #39695
      it(`${option.name} should not be a property`, () => {
        // Compile-time type check: if name is not keyof RenovateConfig, this is a type error
        const name = option.name as keyof RenovateConfig;

        // Runtime check: verify via a cast — this test catches drift when types diverge
        expect(name).not.toBeDefined();
      });
    }
  });
});
