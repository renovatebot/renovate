import { smartTruncate } from './pr-body';
import { Fixtures } from '~test/fixtures';
import { logger } from '~test/util';

const prBody = Fixtures.get('pr-body.txt');

describe('modules/platform/utils/pr-body', () => {
  describe('.smartTruncate', () => {
    it('truncates to 1000', () => {
      const body = smartTruncate(prBody, 1000);
      expect(body).toMatchSnapshot();
      expect(body.length < prBody.length).toBe(true);
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Truncating PR body due to platform limitation of 1000 characters',
      );
    });

    it('truncates to 300 not smart', () => {
      const body = smartTruncate(prBody, 300);
      expect(body).toMatchSnapshot();
      expect(body).toHaveLength(300);
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Truncating PR body due to platform limitation of 300 characters',
      );
    });

    it('truncates to 10', () => {
      const body = smartTruncate('Lorem ipsum dolor sit amet', 10);
      expect(body).toBe('> **Note:*');
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Truncating PR body due to platform limitation of 10 characters',
      );
    });

    it('does not truncate', () => {
      expect(smartTruncate(prBody, 60000)).toEqual(prBody);
    });
  });
});
