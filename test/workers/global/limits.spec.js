const { init } = require('../../../lib/workers/global/limits');

const { getLimitRemaining } = require('../../../lib/workers/global/limits');

const { incrementLimit } = require('../../../lib/workers/global/limits');

describe('lib/workers/global/limits', () => {
  describe('init()', () => {
    it('check defined variables have a value set to zero', async () => {
      const config = { prCommitsPerRunLimit: 3 };
      // const res = await writeUpdates(config, packageFiles, branches);
      await init(config);
      const result = await getLimitRemaining('prCommitsPerRunLimit');
      expect(result).toEqual(3);
    });
  });
  describe('incrementLimit()', () => {
    it('check increment works as expected', async () => {
      const config = { prCommitsPerRunLimit: 3 };
      await init(config);
      await incrementLimit('prCommitsPerRunLimit', 2);
      const result = await getLimitRemaining('prCommitsPerRunLimit');
      expect(result).toEqual(1);
    });
  });
});
