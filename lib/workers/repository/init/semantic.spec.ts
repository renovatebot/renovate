import { RenovateConfig, getConfig, git } from '../../../../test/util';
import { detectSemanticCommits } from './semantic';

jest.mock('../../../util/git');

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
  config.errors = [];
  config.warnings = [];
});

describe('workers/repository/init/semantic', () => {
  describe('detectSemanticCommits()', () => {
    it('returns config if already set', async () => {
      config.semanticCommits = true;
      const res = await detectSemanticCommits(config);
      expect(res).toBe(true);
    });
    it('detects false if unknown', async () => {
      config.semanticCommits = null;
      git.getCommitMessages.mockResolvedValue(['foo', 'bar']);
      const res = await detectSemanticCommits(config);
      expect(res).toBe(false);
    });
    it('detects true if known', async () => {
      config.semanticCommits = null;
      git.getCommitMessages.mockResolvedValue(['fix: foo', 'refactor: bar']);
      const res = await detectSemanticCommits(config);
      expect(res).toBe(true);
    });
  });
});
