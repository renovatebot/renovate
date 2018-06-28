const { DateTime } = require('luxon');
const {
  raiseLockFileIssue,
} = require('../../../lib/workers/repository/error-lockfile');

describe('workers/repository/error-config', () => {
  describe('raiseLockFileIssue()', () => {
    it('raises issue if no releaseTimestamp', async () => {
      const error = new Error('lockfile-error');
      error.fileName = 'yarn.lock';
      error.details = 'Some details here';
      await raiseLockFileIssue(error);
    });
    it('raises issue if greater than a day old', async () => {
      const error = new Error('lockfile-error');
      error.fileName = 'yarn.lock';
      error.details = 'Some details here';
      error.releaseTimestamp = '2017-02-06T20:01:41+00:00';
      await raiseLockFileIssue(error);
    });
    it('skips issue if less than a day old', async () => {
      const error = new Error('lockfile-error');
      error.fileName = 'yarn.lock';
      error.details = 'Some details here';
      error.releaseTimestamp = DateTime.local().toISO();
      await raiseLockFileIssue(error);
    });
  });
});
