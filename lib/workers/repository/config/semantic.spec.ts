import { RenovateConfig, getConfig, git } from '../../../../test/util';
import { initialize } from '../../../util/cache/repository';
import { detectSemanticCommits } from './semantic';

jest.mock('../../../util/git');

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
  config.errors = [];
  config.warnings = [];
});

describe('workers/repository/config/semantic', () => {
  describe('detectSemanticCommits()', () => {
    beforeEach(async () => {
      await initialize({});
    });
    it('detects false if unknown', async () => {
      config.semanticCommits = null;
      git.getCommitMessages.mockResolvedValueOnce(['foo', 'bar']);
      git.getCommitMessages.mockResolvedValueOnce([
        'fix: foo',
        'refactor: bar',
      ]);
      const res = await detectSemanticCommits();
      expect(res).toBe('disabled');
      const res2 = await detectSemanticCommits();
      expect(res2).toBe('disabled');
    });
    it('detects true if known', async () => {
      config.semanticCommits = null;
      git.getCommitMessages.mockResolvedValue(['fix: foo', 'refactor: bar']);
      const res = await detectSemanticCommits();
      expect(res).toBe('enabled');
    });
  });
});
