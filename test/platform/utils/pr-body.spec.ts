import fs from 'fs-extra';
import { smartTruncate } from '../../../lib/platform/utils/pr-body';

describe('platform/utils/pr-body', () => {
  let prBody: string;
  beforeAll(async () => {
    prBody = await fs.readFile(
      'test/platform/utils/_fixtures/pr-body.txt',
      'utf8'
    );
  });
  describe('.smartTruncate', () => {
    it('truncates to 1000', () => {
      const body = smartTruncate(prBody, 1000);
      expect(body).toMatchSnapshot();
      expect(body.length < prBody.length).toEqual(true);
    });

    it('truncates to 10', () => {
      const body = smartTruncate('Lorem ipsum dolor sit amet', 10);
      expect(body).toEqual('Lorem ipsu');
    });

    it('does not truncate', () => {
      expect(smartTruncate(prBody)).toEqual(prBody);
    });
  });
});
