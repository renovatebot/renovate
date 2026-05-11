import { Fixtures } from '~test/fixtures.ts';
import { logger } from '~test/util.ts';
import { smartTruncate } from './pr-body.ts';

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

    it('includes truncation notice at end of truncated content (when "not smart")', () => {
      const body = smartTruncate(prBody, 300);
      expect(body).toContain('PR body was truncated to here');
      expect(body).toHaveLength(300);
    });

    it('includes truncation notice before Configuration section (when "smart")', () => {
      const body = smartTruncate(prBody, 3000);
      expect(body.length).toBeLessThanOrEqual(3000);
      expect(body).toContain('PR body was truncated to here');
      expect(body).toContain('### Configuration');
      expect(body.indexOf('PR body was truncated to here')).toBeLessThan(
        body.indexOf('### Configuration'),
      );
    });

    it('truncates content without release notes structure when notice fits', () => {
      const body = smartTruncate('x'.repeat(500), 200);
      expect(body).toHaveLength(200);
      expect(body).toContain('PR body was truncated to here');
    });

    it('truncates to below notice length with release notes structure', () => {
      const body = smartTruncate(prBody, 50);
      expect(body).toHaveLength(50);
      expect(body).not.toContain('PR body was truncated to here');
    });

    it('truncates to 10', () => {
      const body = smartTruncate('Lorem ipsum dolor sit amet', 10);
      expect(body).toBe('> ℹ️ **Not');
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Truncating PR body due to platform limitation of 10 characters',
      );
    });

    it('does not truncate', () => {
      expect(smartTruncate(prBody, 60000)).toEqual(prBody);
    });
  });
});
