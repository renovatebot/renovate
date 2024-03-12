import { mockDeep } from 'jest-mock-extended';
import { Fixtures } from '../../../../test/fixtures';
import { mocked } from '../../../../test/util';
import * as _hostRules from '../../../util/host-rules';
import { extractPackageFile } from '.';

jest.mock('../../../util/host-rules', () => mockDeep());
const hostRules = mocked(_hostRules);
const filename = '.pre-commit.yaml';

const complexPrecommitConfig = Fixtures.get('complex.pre-commit-config.yaml');
const examplePrecommitConfig = Fixtures.get('.pre-commit-config.yaml');
const emptyReposPrecommitConfig = Fixtures.get(
  'empty_repos.pre-commit-config.yaml',
);
const noReposPrecommitConfig = Fixtures.get('no_repos.pre-commit-config.yaml');
const invalidRepoPrecommitConfig = Fixtures.get(
  'invalid_repo.pre-commit-config.yaml',
);
const enterpriseGitPrecommitConfig = Fixtures.get(
  'enterprise.pre-commit-config.yaml',
);

describe('modules/manager/pre-commit/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for invalid yaml file content', () => {
      const result = extractPackageFile('nothing here: [', filename);
      expect(result).toBeNull();
    });

    it('returns null for empty yaml file content', () => {
      const result = extractPackageFile('', filename);
      expect(result).toBeNull();
    });

    it('returns null for no file content', () => {
      // TODO #22198
      const result = extractPackageFile(null as never, filename);
      expect(result).toBeNull();
    });

    it('returns null for no repos', () => {
      const result = extractPackageFile(noReposPrecommitConfig, filename);
      expect(result).toBeNull();
    });

    it('returns null for empty repos', () => {
      const result = extractPackageFile(emptyReposPrecommitConfig, filename);
      expect(result).toBeNull();
    });

    it('returns null for invalid repo', () => {
      const result = extractPackageFile(invalidRepoPrecommitConfig, filename);
      expect(result).toBeNull();
    });

    it('extracts from values.yaml correctly with same structure as "pre-commit sample-config"', () => {
      const result = extractPackageFile(examplePrecommitConfig, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v2.4.0',
            datasource: 'github-tags',
            depName: 'pre-commit/pre-commit-hooks',
            depType: 'repository',
            packageName: 'pre-commit/pre-commit-hooks',
          },
          {
            currentValue: 'v2.1.0',
            datasource: 'github-tags',
            depName: 'pre-commit/pre-commit-hooks',
            depType: 'repository',
            packageName: 'pre-commit/pre-commit-hooks',
          },
        ],
      });
    });

    it('extracts from complex config file correctly', () => {
      const result = extractPackageFile(complexPrecommitConfig, filename);
      expect(result).toMatchSnapshot({
        deps: [
          { depName: 'pre-commit/pre-commit-hooks', currentValue: 'v3.3.0' },
          { depName: 'psf/black', currentValue: '19.3b0' },
          { depName: 'psf/black', currentValue: '19.3b0' },
          { depName: 'psf/black', currentValue: '19.3b0' },
          {
            depName: 'my/dep',
            currentValue: 'v42.0',
            registryUrls: ['https://gitlab.mycompany.com'],
          },
          {
            depName: 'my/dep',
            currentValue: 'v42.0',
            registryUrls: ['https://gitlab.mycompany.com'],
          },
          { depName: 'prettier/pre-commit', currentValue: 'v2.1.2' },
          { depName: 'prettier/pre-commit', currentValue: 'v2.1.2' },
          { skipReason: 'invalid-url' },
        ],
      });
    });

    it('can handle private git repos', () => {
      // url only
      hostRules.find.mockReturnValueOnce({ token: 'value1' });
      // hostType=github
      hostRules.find.mockReturnValueOnce({});
      // hostType=gitlab
      hostRules.find.mockReturnValueOnce({ token: 'value' });
      const result = extractPackageFile(enterpriseGitPrecommitConfig, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v1.0.0',
            datasource: 'gitlab-tags',
            depName: 'pre-commit/pre-commit-hooks',
            depType: 'repository',
            packageName: 'pre-commit/pre-commit-hooks',
            registryUrls: ['enterprise.com'],
          },
        ],
      });
    });

    it('can handle invalid private git repos', () => {
      hostRules.find.mockReturnValue({});
      const result = extractPackageFile(enterpriseGitPrecommitConfig, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v1.0.0',
            depName: 'pre-commit/pre-commit-hooks',
            depType: 'repository',
            packageName: 'pre-commit/pre-commit-hooks',
            registryUrls: ['enterprise.com'],
            skipReason: 'unknown-registry',
          },
        ],
      });
    });

    it('can handle unknown private git repos', () => {
      // First attemp returns a result
      hostRules.find.mockReturnValueOnce({ token: 'value' });
      // But all subsequent checks (those with hostType), then fail:
      hostRules.find.mockReturnValue({});
      const result = extractPackageFile(enterpriseGitPrecommitConfig, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v1.0.0',
            depName: 'pre-commit/pre-commit-hooks',
            depType: 'repository',
            packageName: 'pre-commit/pre-commit-hooks',
            registryUrls: ['enterprise.com'],
            skipReason: 'unknown-registry',
          },
        ],
      });
    });
  });
});
