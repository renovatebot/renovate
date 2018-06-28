const { DateTime } = require('luxon');
const {
  raiseLockFileIssue,
} = require('../../../lib/workers/repository/error-lockfile');

describe('workers/repository/error-config', () => {
  describe('raiseLockFileIssue()', () => {
    it('warns if no releaseTimestamp', async () => {
      const error = new Error('lockfile-error');
      error.fileName = 'yarn.lock';
      error.details = 'Some details here';
      await raiseLockFileIssue(error);
    });
    it('logs warning if greater than a day old', async () => {
      const error = new Error('lockfile-error');
      error.fileName = 'yarn.lock';
      error.details = 'Some details here';
      error.releaseTimestamp = '2017-02-06T20:01:41+00:00';
      await raiseLockFileIssue(error);
    });
    it('logs no warning if less than a day old', async () => {
      const error = new Error('lockfile-error');
      error.fileName = 'yarn.lock';
      error.details = 'Some details here';
      error.releaseTimestamp = DateTime.local().toISO();
      await raiseLockFileIssue(error);
    });
  });
});
