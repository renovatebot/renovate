import { join } from 'upath';
import { Fixtures } from '../../../../test/fixtures';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { extractPackageFile } from '.';

const plugin1 = Fixtures?.get('tflint-1.hcl');
const configFull = Fixtures?.get('tflint-full.hcl');
const noSource = Fixtures?.get('tflint-no-source.hcl');
const notGithub = Fixtures?.get('tflint-not-github.hcl');

const adminConfig: RepoGlobalConfig = {
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
  containerbaseDir: join('/tmp/cache/containerbase'),
};

// auto-mock fs
jest.mock('../../../util/fs');

describe('modules/manager/tflint-plugin/extract', () => {
  beforeEach(() => {
    GlobalConfig.set(adminConfig);
  });

  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(
        extractPackageFile('nothing here', 'doesnt-exist.hcl', {})
      ).toBeNull();
    });

    it('extracts plugins', () => {
      const res = extractPackageFile(plugin1, 'tflint-1.hcl', {});
      expect(res).toEqual({
        deps: [
          {
            currentValue: '0.1.0',
            datasource: 'github-releases',
            depType: 'plugin',
            depName: 'org/tflint-ruleset-foo',
          },
          {
            currentValue: '1.42.0',
            datasource: 'github-releases',
            depType: 'plugin',
            depName: 'org2/tflint-ruleset-bar',
          },
        ],
      });
    });

    it('extracts from full configuration', () => {
      const res = extractPackageFile(configFull, 'tflint-full.hcl', {});
      expect(res).toEqual({
        deps: [
          {
            currentValue: '0.4.0',
            datasource: 'github-releases',
            depType: 'plugin',
            depName: 'terraform-linters/tflint-ruleset-aws',
          },
        ],
      });
    });

    it('extracts no source', () => {
      const res = extractPackageFile(noSource, 'tflint-no-source.hcl', {});
      expect(res).toEqual({
        deps: [
          {
            currentValue: '0.4.0',
            skipReason: 'no-source',
          },
          {
            skipReason: 'no-source',
          },
        ],
      });
    });

    it('extracts nothing if not from github', () => {
      const res = extractPackageFile(notGithub, 'tflint-not-github.hcl', {});
      expect(res).toEqual({
        deps: [
          {
            currentValue: '0.4.0',
            depName: 'gitlab.com/terraform-linters/tflint-ruleset-aws',
            depType: 'plugin',
            skipReason: 'unsupported-datasource',
          },
        ],
      });
    });
  });
});
