import { RenovateConfig, git, partial } from '../../../test/util';
import { initRepoCache } from '../cache/repository/init';
import { detectSemanticCommits } from './semantic';

jest.mock('.');

let config: RenovateConfig;

beforeEach(() => {
  jest.resetAllMocks();
  config = partial<RenovateConfig>();
});

describe('util/git/semantic', () => {
  describe('detectSemanticCommits()', () => {
    beforeEach(async () => {
      await initRepoCache({ repoFingerprint: '0123456789abcdef' });
    });

    it('detects false if unknown', async () => {
      config.semanticCommits = undefined;
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
      config.semanticCommits = undefined;
      git.getCommitMessages.mockResolvedValue(['fix: foo', 'refactor: bar']);
      const res = await detectSemanticCommits();
      expect(res).toBe('enabled');
    });
  });
});
