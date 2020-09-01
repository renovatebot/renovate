import fs from 'fs';
import path from 'path';
import { RenovateConfig, getConfig } from '../../test/util';
import { migrateAndValidate } from './migrate-validate';

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
});

describe('config/migrate-validate', () => {
  describe('migrateAndValidate()', () => {
    it('handles empty', async () => {
      const res = await migrateAndValidate(config, {});
      expect(res).toMatchSnapshot();
    });
    it('handles migration', async () => {
      const input: RenovateConfig = { automerge: 'none' as any };
      const res = await migrateAndValidate(config, input);
      expect(res).toMatchSnapshot();
    });
    it('handles invalid', async () => {
      const input: RenovateConfig = { foo: 'none' };
      const res = await migrateAndValidate(config, input);
      expect(res).toMatchSnapshot();
      expect(res.errors).toHaveLength(1);
    });

    it('isOnboarded', async () => {
      const input: RenovateConfig = {};
      const res = await migrateAndValidate(
        { ...config, repoIsOnboarded: true, warnings: undefined },
        input
      );
      expect(res.warnings).toBeUndefined();
      expect(res).toMatchSnapshot();
    });

    it('reads private key from file', async () => {
      const input: RenovateConfig = {
        privateKeyPath: path.join(__dirname, '/keys/__fixtures__/private.pem'),
      };
      const res = await migrateAndValidate(
        { ...config, repoIsOnboarded: true, warnings: undefined },
        input
      );

      const expected = fs.readFileSync(input.privateKeyPath);
      expect(res.privateKey).toBe(expected);
    });
  });
});
