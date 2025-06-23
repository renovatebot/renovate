import { Fixtures } from '../../../../test/fixtures';
import { smartTruncate } from './pr-body';

const prBody = Fixtures.get('pr-body.txt');

describe('modules/platform/utils/pr-body', () => {
  describe('.smartTruncate', () => {
    it('truncates to 1000', () => {
      const body = smartTruncate(prBody, 1000);
      expect(body).toMatchSnapshot();
      expect(body.length < prBody.length).toBe(true);
    });

    it('truncates to 300 not smart', () => {
      const body = smartTruncate(prBody, 300);
      expect(body).toMatchSnapshot();
      expect(body).toHaveLength(300);
    });

    it('truncates to 10', () => {
      const body = smartTruncate('Lorem ipsum dolor sit amet', 10);
      expect(body).toBe('Lorem ipsu');
    });

    it('does not truncate', () => {
      expect(smartTruncate(prBody, 60000)).toEqual(prBody);
    });
  });
});
