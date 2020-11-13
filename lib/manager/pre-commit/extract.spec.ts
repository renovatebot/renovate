import { readFileSync } from 'fs';
import { mocked } from '../../../test/util';
import * as _hostRules from '../../util/host-rules';
import { extractPackageFile } from './extract';

jest.mock('../../util/host-rules');
const hostRules = mocked(_hostRules);

const complexPrecommitConfig = readFileSync(
  'lib/manager/pre-commit/__fixtures__/complex.pre-commit-config.yaml',
  'utf8'
);

const examplePrecommitConfig = readFileSync(
  'lib/manager/pre-commit/__fixtures__/.pre-commit-config.yaml',
  'utf8'
);

const emptyReposPrecommitConfig = readFileSync(
  'lib/manager/pre-commit/__fixtures__/empty_repos.pre-commit-config.yaml',
  'utf8'
);

const noReposPrecommitConfig = readFileSync(
  'lib/manager/pre-commit/__fixtures__/no_repos.pre-commit-config.yaml',
  'utf8'
);

const invalidRepoPrecommitConfig = readFileSync(
  'lib/manager/pre-commit/__fixtures__/invalid_repo.pre-commit-config.yaml',
  'utf8'
);

const enterpriseGitlabPrecommitConfig = readFileSync(
  'lib/manager/pre-commit/__fixtures__/enterprise_gitlab.pre-commit-config.yaml',
  'utf8'
);

describe('lib/manager/precommit/extract', () => {
  describe('extractPackageFile()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });
    it('returns null for invalid yaml file content', () => {
      const result = extractPackageFile('nothing here: [');
      expect(result).toBeNull();
    });
    it('returns null for empty yaml file content', () => {
      const result = extractPackageFile('');
      expect(result).toBeNull();
    });
    it('returns null for no file content', () => {
      const result = extractPackageFile(null);
      expect(result).toBeNull();
    });
    it('returns null for no repos', () => {
      const result = extractPackageFile(noReposPrecommitConfig);
      expect(result).toBeNull();
    });
    it('returns null for empty repos', () => {
      const result = extractPackageFile(emptyReposPrecommitConfig);
      expect(result).toBeNull();
    });
    it('returns null for invalid repo', () => {
      const result = extractPackageFile(invalidRepoPrecommitConfig);
      expect(result).toBeNull();
    });
    it('extracts from values.yaml correctly with same structure as "pre-commit sample-config"', () => {
      const result = extractPackageFile(examplePrecommitConfig);
      expect(result).toMatchSnapshot();
    });
    it('extracts from complex config file correctly', () => {
      const result = extractPackageFile(complexPrecommitConfig);
      expect(result).toMatchSnapshot();
    });
    it('can handle private gitlab repos', () => {
      // gitlab
      hostRules.find.mockReturnValueOnce({ hostType: 'gitlab' });
      // no matching rules
      hostRules.find.mockReturnValueOnce({});
      // gitea
      hostRules.find.mockReturnValueOnce({ hostType: 'gitea' });
      // github
      hostRules.find.mockReturnValueOnce({ hostType: 'github' });
      // Unknown host type
      hostRules.find.mockReturnValueOnce({ hostType: 'somethingUnknown' });
      const result = extractPackageFile(enterpriseGitlabPrecommitConfig);
      expect(result).toMatchSnapshot();
    });
  });
});
