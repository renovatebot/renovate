import { partial } from '~test/util.ts';
import { logger } from '../../../../logger/index.ts';
import { regEx } from '../../../../util/regex.ts';
import type { PackageFileInfo, RegexManagerConfig } from './types.ts';
import * as utils from './utils.ts';

const baseConfig = partial<RegexManagerConfig>({ matchStrings: [] });
const baseFileInfo = partial<PackageFileInfo>({
  packageFile: 'file.txt',
  packageFileName: 'file.txt',
  packageFileDir: '.',
  content: '',
});

describe('modules/manager/custom/regex/utils', () => {
  it('does not crash for lazy regex', () => {
    const lazyMatch = regEx('(?<currentDigest>.*?)', 'g');
    expect(
      utils.regexMatchAll(
        lazyMatch,
        '1f699d2bfc99bbbe4c1ed5bb8fc21e6911d69c6e\n',
      ),
    ).toBeArray();
  });

  describe('createDependency', () => {
    it('sets registryUrls when registryUrl group is a valid URL', () => {
      const dep = utils.createDependency(
        {
          groups: { registryUrl: 'https://registry.example.com/' },
          replaceString: undefined,
        },
        baseConfig,
        baseFileInfo,
      );
      expect(dep?.registryUrls).toEqual(['https://registry.example.com/']);
    });

    it('warns and skips registryUrls when registryUrl group is an invalid URL', () => {
      const dep = utils.createDependency(
        {
          groups: { registryUrl: 'not-a-valid-url' },
          replaceString: undefined,
        },
        baseConfig,
        baseFileInfo,
      );
      expect(dep?.registryUrls).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        { value: 'not-a-valid-url' },
        'Invalid regex manager registryUrl',
      );
    });

    it('sets datasource when datasource group is provided', () => {
      const dep = utils.createDependency(
        {
          groups: { datasource: 'npm', currentValue: '1.0.0', depName: 'foo' },
          replaceString: undefined,
        },
        baseConfig,
        baseFileInfo,
      );
      expect(dep?.datasource).toBe('npm');
    });

    it('sets indentation when indentation group is whitespace', () => {
      const dep = utils.createDependency(
        {
          groups: { indentation: '  ', depName: 'foo' },
          replaceString: undefined,
        },
        baseConfig,
        baseFileInfo,
      );
      expect(dep?.indentation).toBe('  ');
    });

    it('sets empty indentation when indentation group is non-whitespace', () => {
      const dep = utils.createDependency(
        {
          groups: { indentation: 'abc', depName: 'foo' },
          replaceString: undefined,
        },
        baseConfig,
        baseFileInfo,
      );
      expect(dep?.indentation).toBe('');
    });

    it('sets depName via default branch', () => {
      const dep = utils.createDependency(
        {
          groups: { depName: 'my-package' },
          replaceString: undefined,
        },
        baseConfig,
        baseFileInfo,
      );
      expect(dep?.depName).toBe('my-package');
    });
  });
});
