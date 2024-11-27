import { Fixtures } from '../../../test/fixtures';
import { CONFIG_VALIDATION } from '../../constants/error-messages';
import { decryptConfig } from '../decrypt';
import { GlobalConfig } from '../global';
import type { RenovateConfig } from '../types';

const privateKey = Fixtures.get('private.pem', '..');
const repository = 'abc/def';

describe('config/decrypt/legacy', () => {
  describe('decryptConfig()', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      config = {};
      GlobalConfig.reset();
    });

    it('handles invalid encrypted type', async () => {
      config.encrypted = 1;
      GlobalConfig.set({ privateKey });
      const res = await decryptConfig(config, repository);
      expect(res.encrypted).toBeUndefined();
    });

    it('handles invalid encrypted value', async () => {
      config.encrypted = { a: 1 };
      GlobalConfig.set({ privateKey, privateKeyOld: 'invalid-key' });
      await expect(decryptConfig(config, repository)).rejects.toThrow(
        CONFIG_VALIDATION,
      );
    });

    it('replaces npm token placeholder in npmrc', async () => {
      GlobalConfig.set({
        privateKey: 'invalid-key',
        privateKeyOld: privateKey,
      }); // test old key failover
      config.npmrc =
        '//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n';
      config.encrypted = {
        npmToken:
          'FLA9YHIzpE7YetAg/P0X46npGRCMqn7hgyzwX5ZQ9wYgu9BRRbTiBVsUIFTyM5BuP1Q22slT2GkWvFvum7GU236Y6QiT7Nr8SLvtsJn2XUuq8H7REFKzdy3+wqyyWbCErYTFyY1dcPM7Ht+CaGDWdd8u/FsoX7AdMRs/X1jNUo6iSmlUiyGlYDKF+QMnCJom1VPVgZXWsGKdjI2MLny991QMaiv0VajmFIh4ENv4CtXOl/1twvIl/6XTXAaqpJJKDTPZEuydi+PHDZmal2RAOfrkH4m0UURa7SlfpUlIg+EaqbNGp85hCYXLwRcEET1OnYr3rH1oYkcYJ40any1tvQ==',
      };
      const res = await decryptConfig(config, repository);
      expect(res.encrypted).toBeUndefined();
      expect(res.npmToken).toBe('abcdef-ghijklm-nopqf-stuvwxyz');
    });

    it('appends npm token in npmrc', async () => {
      GlobalConfig.set({ privateKey });
      config.npmrc = 'foo=bar\n';
      config.encrypted = {
        npmToken:
          'FLA9YHIzpE7YetAg/P0X46npGRCMqn7hgyzwX5ZQ9wYgu9BRRbTiBVsUIFTyM5BuP1Q22slT2GkWvFvum7GU236Y6QiT7Nr8SLvtsJn2XUuq8H7REFKzdy3+wqyyWbCErYTFyY1dcPM7Ht+CaGDWdd8u/FsoX7AdMRs/X1jNUo6iSmlUiyGlYDKF+QMnCJom1VPVgZXWsGKdjI2MLny991QMaiv0VajmFIh4ENv4CtXOl/1twvIl/6XTXAaqpJJKDTPZEuydi+PHDZmal2RAOfrkH4m0UURa7SlfpUlIg+EaqbNGp85hCYXLwRcEET1OnYr3rH1oYkcYJ40any1tvQ==',
      };
      const res = await decryptConfig(config, repository);
      expect(res.encrypted).toBeUndefined();
      expect(res.npmToken).toBe('abcdef-ghijklm-nopqf-stuvwxyz');
    });

    it('decrypts nested', async () => {
      GlobalConfig.set({ privateKey });
      config.packageFiles = [
        {
          packageFile: 'package.json',
          devDependencies: {
            encrypted: {
              branchPrefix:
                'FLA9YHIzpE7YetAg/P0X46npGRCMqn7hgyzwX5ZQ9wYgu9BRRbTiBVsUIFTyM5BuP1Q22slT2GkWvFvum7GU236Y6QiT7Nr8SLvtsJn2XUuq8H7REFKzdy3+wqyyWbCErYTFyY1dcPM7Ht+CaGDWdd8u/FsoX7AdMRs/X1jNUo6iSmlUiyGlYDKF+QMnCJom1VPVgZXWsGKdjI2MLny991QMaiv0VajmFIh4ENv4CtXOl/1twvIl/6XTXAaqpJJKDTPZEuydi+PHDZmal2RAOfrkH4m0UURa7SlfpUlIg+EaqbNGp85hCYXLwRcEET1OnYr3rH1oYkcYJ40any1tvQ==',
              npmToken:
                'FLA9YHIzpE7YetAg/P0X46npGRCMqn7hgyzwX5ZQ9wYgu9BRRbTiBVsUIFTyM5BuP1Q22slT2GkWvFvum7GU236Y6QiT7Nr8SLvtsJn2XUuq8H7REFKzdy3+wqyyWbCErYTFyY1dcPM7Ht+CaGDWdd8u/FsoX7AdMRs/X1jNUo6iSmlUiyGlYDKF+QMnCJom1VPVgZXWsGKdjI2MLny991QMaiv0VajmFIh4ENv4CtXOl/1twvIl/6XTXAaqpJJKDTPZEuydi+PHDZmal2RAOfrkH4m0UURa7SlfpUlIg+EaqbNGp85hCYXLwRcEET1OnYr3rH1oYkcYJ40any1tvQ==',
            },
          },
        },
        'backend/package.json',
      ];
      // TODO: fix types #22198
      const res = (await decryptConfig(config, repository)) as any;
      expect(res.encrypted).toBeUndefined();
      expect(res.packageFiles[0].devDependencies.encrypted).toBeUndefined();
      expect(res.packageFiles[0].devDependencies.branchPrefix).toBe(
        'abcdef-ghijklm-nopqf-stuvwxyz',
      );
      expect(res.packageFiles[0].devDependencies.npmToken).toBe(
        'abcdef-ghijklm-nopqf-stuvwxyz',
      );
    });
  });
});
