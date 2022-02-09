import { loadFixture, mocked } from '../../../test/util';
import * as _hostRules from '../../util/host-rules';
import { extractPackageFile } from './extract';

jest.mock('../../util/host-rules');
const hostRules = mocked(_hostRules);
const filename = '.pre-commit.yaml';

const complexPrecommitConfig = loadFixture('complex.pre-commit-config.yaml');
const examplePrecommitConfig = loadFixture('.pre-commit-config.yaml');
const emptyReposPrecommitConfig = loadFixture(
  'empty_repos.pre-commit-config.yaml'
);
const noReposPrecommitConfig = loadFixture('no_repos.pre-commit-config.yaml');
const invalidRepoPrecommitConfig = loadFixture(
  'invalid_repo.pre-commit-config.yaml'
);
const enterpriseGitPrecommitConfig = loadFixture(
  'enterprise.pre-commit-config.yaml'
);

describe('manager/pre-commit/extract', () => {
  describe('extractPackageFile()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });
    it('returns null for invalid yaml file content', () => {
      const result = extractPackageFile('nothing here: [', filename);
      expect(result).toBeNull();
    });
    it('returns null for empty yaml file content', () => {
      const result = extractPackageFile('', filename);
      expect(result).toBeNull();
    });
    it('returns null for no file content', () => {
      const result = extractPackageFile(null, filename);
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
            lookupName: 'pre-commit/pre-commit-hooks',
          },
          {
            currentValue: 'v2.1.0',
            datasource: 'github-tags',
            depName: 'pre-commit/pre-commit-hooks',
            depType: 'repository',
            lookupName: 'pre-commit/pre-commit-hooks',
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
          { depName: 'prettier/pre-commit', currentValue: 'v2.1.2' },
          { depName: 'prettier/pre-commit', currentValue: 'v2.1.2' },
          { skipReason: 'invalid-url' },
        ],
      });
    });
    it('can handle private git repos', () => {
      hostRules.find.mockReturnValue({ token: 'value' });
      const result = extractPackageFile(enterpriseGitPrecommitConfig, filename);
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v1.0.0',
            datasource: 'gitlab-tags',
            depName: 'pre-commit/pre-commit-hooks',
            depType: 'repository',
            lookupName: 'pre-commit/pre-commit-hooks',
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
            lookupName: 'pre-commit/pre-commit-hooks',
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
            lookupName: 'pre-commit/pre-commit-hooks',
            registryUrls: ['enterprise.com'],
            skipReason: 'unknown-registry',
          },
        ],
      });
    });
  });
});
