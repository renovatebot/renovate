import { getLockFileName } from './lockfile.ts';

describe('modules/manager/mise/lockfile', () => {
  describe('getLockFileName()', () => {
    it.each`
      configPath                    | expected
      ${'mise.toml'}                | ${'mise.lock'}
      ${'.mise.toml'}               | ${'mise.lock'}
      ${'config.toml'}              | ${'mise.lock'}
      ${'mise.test.toml'}           | ${'mise.test.lock'}
      ${'mise.staging.toml'}        | ${'mise.staging.lock'}
      ${'mise.local.toml'}          | ${'mise.local.lock'}
      ${'mise.test.local.toml'}     | ${'mise.test.local.lock'}
      ${'subdir/mise.toml'}         | ${'subdir/mise.lock'}
      ${'subdir/mise.prod.toml'}    | ${'subdir/mise.prod.lock'}
      ${'conf.d/python.toml'}       | ${'mise.lock'}
      ${'project/conf.d/node.toml'} | ${'project/mise.lock'}
    `('returns $expected for $configPath', ({ configPath, expected }) => {
      expect(getLockFileName(configPath)).toBe(expected);
    });
  });
});
