import { CircleCiOrb } from './schema.ts';

describe('modules/manager/circleci/schema', () => {
  describe('CircleCiOrb', () => {
    it('catches invalid nested orbs value', () => {
      const result = CircleCiOrb.safeParse({
        executors: {},
        jobs: {},
        orbs: { foo: 123 },
      });
      expect(result.success).toBeTrue();
      expect(result.data?.orbs).toEqual({});
    });
  });
});
