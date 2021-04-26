import { getName, loadFixture } from '../../../test/util';
import { smartTruncate } from './pr-body';

const prBody = loadFixture('pr-body.txt');

describe(getName(), () => {
  describe('.smartTruncate', () => {
    it('truncates to 1000', () => {
      const body = smartTruncate(prBody, 1000);
      expect(body).toMatchSnapshot();
      expect(body.length < prBody.length).toEqual(true);
    });

    it('truncates to 300 not smart', () => {
      const body = smartTruncate(prBody, 300);
      expect(body).toMatchSnapshot();
      expect(body).toHaveLength(300);
    });

    it('truncates to 10', () => {
      const body = smartTruncate('Lorem ipsum dolor sit amet', 10);
      expect(body).toEqual('Lorem ipsu');
    });

    it('does not truncate', () => {
      expect(smartTruncate(prBody, 60000)).toEqual(prBody);
    });
  });
});
