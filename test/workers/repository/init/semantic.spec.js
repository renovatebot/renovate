/** @type any */
let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = require('../../../config/config/_fixtures');
  config.errors = [];
  config.warnings = [];
});

const {
  detectSemanticCommits,
} = require('../../../../lib/workers/repository/init/semantic');

/** @type any */
const platform = global.platform;

describe('workers/repository/init/semantic', () => {
  describe('detectSemanticCommits()', () => {
    it('returns config if already set', async () => {
      config.semanticCommits = true;
      const res = await detectSemanticCommits(config);
      expect(res).toBe(true);
    });
    it('detects false if unknown', async () => {
      config.semanticCommits = null;
      platform.getCommitMessages.mockReturnValue(['foo', 'bar']);
      const res = await detectSemanticCommits(config);
      expect(res).toBe(false);
    });
    it('detects true if known', async () => {
      config.semanticCommits = null;
      platform.getCommitMessages.mockReturnValue(['fix: foo', 'refactor: bar']);
      const res = await detectSemanticCommits(config);
      expect(res).toBe(true);
    });
  });
});
