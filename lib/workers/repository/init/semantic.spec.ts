import {
  RenovateConfig,
  getConfig,
  git,
  testName,
} from '../../../../test/util';
import { detectSemanticCommits } from './semantic';

jest.mock('../../../util/git');

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
  config.errors = [];
  config.warnings = [];
});

describe(testName(), () => {
  describe('detectSemanticCommits()', () => {
    it('detects false if unknown', async () => {
      config.semanticCommits = null;
      git.getCommitMessages.mockResolvedValue(['foo', 'bar']);
      const res = await detectSemanticCommits();
      expect(res).toBe('disabled');
    });
    it('detects true if known', async () => {
      config.semanticCommits = null;
      git.getCommitMessages.mockResolvedValue(['fix: foo', 'refactor: bar']);
      const res = await detectSemanticCommits();
      expect(res).toBe('enabled');
    });
  });
});
