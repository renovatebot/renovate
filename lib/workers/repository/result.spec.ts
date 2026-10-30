import type { RenovateConfig } from '~test/util.ts';
import { partial } from '~test/util.ts';
import { processResult } from './result.ts';

let config: RenovateConfig;

beforeEach(() => {
  config = partial<RenovateConfig>({
    repoIsActivated: true,
    repoIsOnboarded: true,
  });
});

describe('workers/repository/result', () => {
  describe('processResult()', () => {
    it('runs', () => {
      const result = processResult(config, 'done');
      expect(result).not.toBeNil();
    });

    it('reports an onboarding repository', () => {
      config.repoIsActivated = false;
      config.repoIsOnboarded = false;

      const result = processResult(config, 'onboarding');

      expect(result).toEqual({
        res: 'onboarding',
        status: 'onboarding',
        enabled: true,
        onboarded: false,
        exitCode: 0,
      });
    });

    it.each`
      res                      | exitCode
      ${'done'}                | ${0}
      ${'disabled-by-config'}  | ${0}
      ${'out-of-memory'}       | ${3}
      ${'bad-credentials'}     | ${4}
      ${'config-validation'}   | ${5}
      ${'temporary-error'}     | ${6}
      ${'external-host-error'} | ${7}
      ${'unknown-error'}       | ${8}
    `('maps $res to exit code $exitCode', ({ res, exitCode }) => {
      expect(processResult(config, res).exitCode).toBe(exitCode);
    });
  });
});
