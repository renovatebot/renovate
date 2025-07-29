import {
  decryptConfig,
  getAzureCollection,
  validateDecryptedValue,
} from './decrypt';
import { GlobalConfig } from './global';
import type { RenovateConfig } from './types';
import { logger } from '~test/util';

const repository = 'abc/def';

describe('config/decrypt', () => {
  describe('decryptConfig()', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      config = {};
      GlobalConfig.reset();
      delete process.env.MEND_HOSTED;
      delete process.env.RENOVATE_X_ENCRYPTED_STRICT;
    });

    it('returns empty with no privateKey', async () => {
      delete config.encrypted;
      const res = await decryptConfig(config, repository);
      expect(res).toMatchObject(config);
    });

    it('warns if no privateKey found', async () => {
      config.encrypted = { a: '1' };
      GlobalConfig.set({ encryptedWarning: 'text' });

      const res = await decryptConfig(config, repository);

      expect(logger.logger.once.warn).toHaveBeenCalledWith('text');
      expect(res.encrypted).toBeUndefined();
      expect(res.a).toBeUndefined();
    });

    it('throws exception if encrypted found but no privateKey', async () => {
      config.encrypted = { a: '1' };

      process.env.RENOVATE_X_ENCRYPTED_STRICT = 'true';
      await expect(decryptConfig(config, repository)).rejects.toThrow(
        'config-validation',
      );
    });

    // coverage
    it('throws exception if encrypted found but no privateKey- Mend Hosted', async () => {
      config.encrypted = { a: '1' };

      process.env.MEND_HOSTED = 'true';
      process.env.RENOVATE_X_ENCRYPTED_STRICT = 'true';
      await expect(decryptConfig(config, repository)).rejects.toThrow(
        'config-validation',
      );
    });
  });

  describe('validateDecryptedValue()', () => {
    beforeEach(() => {
      GlobalConfig.reset();
    });

    describe('platforms non azure', () => {
      it.each`
        str                                                 | repo             | expected
        ${'{"o":"abcd",         "r":"",     "v":"123#'}     | ${'abcd/edf'}    | ${null}
        ${'{"o":"abcd",         "r":"",     "v":""}'}       | ${'abcd/edf'}    | ${null}
        ${'{"o":"",             "r":"",     "v":"val"}'}    | ${'abcd/edf'}    | ${null}
        ${'{"o":"abcd",         "r":"edf",  "v":"val-1"}'}  | ${'abcd/edf'}    | ${'val-1'}
        ${'{"o":"abcd",         "r":"",     "v":"val-2"}'}  | ${'abcd/edf'}    | ${'val-2'}
        ${'{"o":"abcd/fgh",     "r":"ef",   "v":"val-3"}'}  | ${'abcd/fgh/ef'} | ${'val-3'}
        ${'{"o":"abcd/fgh",     "r":"",     "v":"val-4"}'}  | ${'abcd/fgh/ef'} | ${'val-4'}
        ${'{"o":"a/b/c/d",      "r":"ef",   "v":"val-5"}'}  | ${'a/b/c/d/ef'}  | ${'val-5'}
        ${'{"o":"abcd/fgh",     "r":"any",  "v":"val-6"}'}  | ${'abcd/fgh/ef'} | ${null}
        ${'{"o":"abcd/xy",      "r":"",     "v":"val-7"}'}  | ${'abcd/fgh/ef'} | ${null}
        ${'{"o":"xy",           "r":"",     "v":"val-8"}'}  | ${'abcd/fgh/ef'} | ${null}
        ${'{"o":"xy, abcd/fgh", "r":"ef",   "v":"val-9"}'}  | ${'abcd/fgh/ef'} | ${'val-9'}
        ${'{"o":"xy ,abcd",     "r":"ef",   "v":"val-10"}'} | ${'abcd/ef'}     | ${'val-10'}
        ${'{"o":"abcd, xy",     "r":"",     "v":"val-11"}'} | ${'abcd/fgh/ef'} | ${'val-11'}
        ${'{"o":"abcd,xy ",     "r":"",     "v":"val-12"}'} | ${'abcd/ef'}     | ${'val-12'}
        ${'{"o":" xy,abc",      "r":"",     "v":"val-13"}'} | ${'abcd/fgh/ef'} | ${null}
      `('equals("$str", "$repo") === $expected', ({ str, repo, expected }) => {
        expect(validateDecryptedValue(str, repo)).toBe(expected);
      });
    });

    describe('azure only platform', () => {
      describe('general tests', () => {
        it.each`
          str                                                    | repo         | expected
          ${'{"o":"any",           "r":"",     "v":"wrong-123#'} | ${'fgh/rp1'} | ${null}
          ${'{"o":"any",           "r":"",     "v":""}'}         | ${'fgh/rp1'} | ${null}
          ${'{"o":"",              "r":"",     "v":"any"}'}      | ${'fgh/rp1'} | ${null}
          ${'{"o":"fgh",           "r":"rp1",  "v":"zv-1"}'}     | ${'fgh/rp1'} | ${'zv-1'}
          ${'{"o":"fgh",           "r":"",     "v":"zv-2"}'}     | ${'fgh/rp1'} | ${'zv-2'}
          ${'{"o":"az123/fgh",     "r":"rp1",  "v":"zv-3"}'}     | ${'fgh/rp1'} | ${'zv-3'}
          ${'{"o":"az123/fgh",     "r":"",     "v":"zv-4"}'}     | ${'fgh/rp1'} | ${'zv-4'}
          ${'{"o":"az123/*",       "r":"",     "v":"zv-5"}'}     | ${'fgh/rp1'} | ${'zv-5'}
          ${'{"o":"az123/",        "r":"",     "v":"zv-6"}'}     | ${'fgh/rp1'} | ${null}
          ${'{"o":"az123",         "r":"",     "v":"zv-7"}'}     | ${'fgh/rp1'} | ${null}
          ${'{"o":"az1",           "r":"",     "v":"zv-8"}'}     | ${'fgh/rp1'} | ${null}
          ${'{"o":"az123/any",     "r":"rp1",  "v":"zv-9"}'}     | ${'fgh/rp1'} | ${null}
          ${'{"o":"az123/any",     "r":"",     "v":"zv-10"}'}    | ${'fgh/rp1'} | ${null}
          ${'{"o":"any/*",         "r":"",     "v":"zv-11"}'}    | ${'fgh/rp1'} | ${null}
          ${'{"o":"az123/*,any/*", "r":"",     "v":"zv-12"}'}    | ${'fgh/rp1'} | ${'zv-12'}
          ${'{"o":"fgh,any/*",     "r":"",     "v":"zv-13"}'}    | ${'fgh/rp1'} | ${'zv-13'}
          ${'{"o":"az123/,any/*",  "r":"",     "v":"zv-14"}'}    | ${'fgh/rp1'} | ${null}
          ${'{"o":"any/*,fgh/",    "r":"",     "v":"zv-15"}'}    | ${'fgh/rp1'} | ${'zv-15'}
          ${'{"o":"any/*,az123",   "r":"",     "v":"zv-16"}'}    | ${'fgh/rp1'} | ${null}
          ${'{"o":"any/*,az12",    "r":"",     "v":"zv-17"}'}    | ${'fgh/rp1'} | ${null}
          ${'{"o":"az12,any/*",    "r":"",     "v":"zv-18"}'}    | ${'fgh/rp1'} | ${null}
        `(
          'equals("$str", "$repo") === $expected',
          ({ str, repo, expected }) => {
            GlobalConfig.set({
              platform: 'azure',
              endpoint: 'https://dev.azure.com/az123',
            });
            expect(validateDecryptedValue(str, repo)).toBe(expected);
          },
        );
      });

      describe('tests self hosted - ignore "tfs/" before collection name', () => {
        it.each`
          str                                                    | repo         | expected
          ${'{"o":"any",           "r":"",     "v":"wrong-123#'} | ${'fgh/rp1'} | ${null}
          ${'{"o":"any",           "r":"",     "v":""}'}         | ${'fgh/rp1'} | ${null}
          ${'{"o":"",              "r":"",     "v":"any"}'}      | ${'fgh/rp1'} | ${null}
          ${'{"o":"fgh",           "r":"rp1",  "v":"zv-1"}'}     | ${'fgh/rp1'} | ${'zv-1'}
          ${'{"o":"fgh",           "r":"",     "v":"zv-2"}'}     | ${'fgh/rp1'} | ${'zv-2'}
          ${'{"o":"az123/fgh",     "r":"rp1",  "v":"zv-3"}'}     | ${'fgh/rp1'} | ${'zv-3'}
          ${'{"o":"az123/fgh",     "r":"",     "v":"zv-4"}'}     | ${'fgh/rp1'} | ${'zv-4'}
          ${'{"o":"az123/*",       "r":"",     "v":"zv-5"}'}     | ${'fgh/rp1'} | ${'zv-5'}
          ${'{"o":"az123/",        "r":"",     "v":"zv-6"}'}     | ${'fgh/rp1'} | ${null}
          ${'{"o":"az123",         "r":"",     "v":"zv-7"}'}     | ${'fgh/rp1'} | ${null}
          ${'{"o":"az1",           "r":"",     "v":"zv-8"}'}     | ${'fgh/rp1'} | ${null}
          ${'{"o":"az123/any",     "r":"rp1",  "v":"zv-9"}'}     | ${'fgh/rp1'} | ${null}
          ${'{"o":"az123/any",     "r":"",     "v":"zv-10"}'}    | ${'fgh/rp1'} | ${null}
          ${'{"o":"any/*",         "r":"",     "v":"zv-11"}'}    | ${'fgh/rp1'} | ${null}
          ${'{"o":"az123/*,any/*", "r":"",     "v":"zv-12"}'}    | ${'fgh/rp1'} | ${'zv-12'}
          ${'{"o":"fgh,any/*",     "r":"",     "v":"zv-13"}'}    | ${'fgh/rp1'} | ${'zv-13'}
          ${'{"o":"az123/,any/*",  "r":"",     "v":"zv-14"}'}    | ${'fgh/rp1'} | ${null}
          ${'{"o":"any/*,fgh/",    "r":"",     "v":"zv-15"}'}    | ${'fgh/rp1'} | ${'zv-15'}
          ${'{"o":"any/*,az123",   "r":"",     "v":"zv-16"}'}    | ${'fgh/rp1'} | ${null}
          ${'{"o":"any/*,az12",    "r":"",     "v":"zv-17"}'}    | ${'fgh/rp1'} | ${null}
          ${'{"o":"az12,any/*",    "r":"",     "v":"zv-18"}'}    | ${'fgh/rp1'} | ${null}
        `(
          'equals("$str", "$repo") === $expected',
          ({ str, repo, expected }) => {
            GlobalConfig.set({
              platform: 'azure',
              endpoint: 'http://your-server-name:8080/tfs/az123',
            });
            expect(validateDecryptedValue(str, repo)).toBe(expected);
          },
        );
      });

      it('endpoint URL invalid', () => {
        GlobalConfig.set({
          platform: 'azure',
          endpoint: 'ht tps://dev.az ure.com/az123',
        });
        expect(
          validateDecryptedValue(
            '{"o":"proj", "r":"repo", "v":"any-1"}',
            'proj/repo',
          ),
        ).toBe('any-1');
        expect(
          validateDecryptedValue(
            '{"o":"proj", "r":"", "v":"any-2"}',
            'proj/repo',
          ),
        ).toBe('any-2');

        expect(
          validateDecryptedValue(
            '{"o":"col/proj", "r":"", "v":"any"}',
            'proj/repo',
          ),
        ).toBeNull();
        expect(
          validateDecryptedValue(
            '{"o":"col/*", "r":"", "v":"any"}',
            'proj/repo',
          ),
        ).toBeNull();
      });

      it('endpoint URL without collection', () => {
        GlobalConfig.set({
          platform: 'azure',
          endpoint: 'https://dev.azure.com/',
        });
        expect(
          validateDecryptedValue(
            '{"o":"proj", "r":"repo", "v":"any-3"}',
            'proj/repo',
          ),
        ).toBe('any-3');
        expect(
          validateDecryptedValue(
            '{"o":"proj", "r":"", "v":"any-4"}',
            'proj/repo',
          ),
        ).toBe('any-4');

        expect(
          validateDecryptedValue(
            '{"o":"col/proj", "r":"", "v":"any"}',
            'proj/repo',
          ),
        ).toBeNull();
        expect(
          validateDecryptedValue(
            '{"o":"col/*", "r":"", "v":"any"}',
            'proj/repo',
          ),
        ).toBeNull();
      });
    });
  });

  describe('getAzureCollection()', () => {
    beforeEach(() => {
      GlobalConfig.reset();
    });

    it('no pathname and url ends with slash', () => {
      GlobalConfig.set({
        platform: 'azure',
        endpoint: 'https://dev.azure.com/',
      });
      expect(getAzureCollection()).toBeUndefined();
    });

    it('no pathname and no slash at end of URL', () => {
      GlobalConfig.set({
        platform: 'azure',
        endpoint: 'https://dev.azure.com',
      });
      expect(getAzureCollection()).toBeUndefined();
    });

    it('pathname no slash at end', () => {
      GlobalConfig.set({
        platform: 'azure',
        endpoint: 'https://dev.azure.com/aaa',
      });
      expect(getAzureCollection()).toBe('aaa');
    });

    it('pathname with slash at end', () => {
      GlobalConfig.set({
        platform: 'azure',
        endpoint: 'https://dev.azure.com/aaa/',
      });
      expect(getAzureCollection()).toBe('aaa');
    });

    it('pathname 2 levels no slash at end', () => {
      GlobalConfig.set({
        platform: 'azure',
        endpoint: 'https://dev.azure.com/aaa/bbb',
      });
      expect(getAzureCollection()).toBe('aaa/bbb');
    });

    it('pathname 2 levels with slash at end', () => {
      GlobalConfig.set({
        platform: 'azure',
        endpoint: 'https://dev.azure.com/aaa/bbb/',
      });
      expect(getAzureCollection()).toBe('aaa/bbb');
    });
  });
});
