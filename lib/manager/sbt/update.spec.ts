import { logger } from '../../logger';
import * as sbtUpdater from './update';

describe('lib/manager/sbt/update', () => {
  describe('.bumpPackageVersion()', () => {
    const content =
      'name := "test"\n' +
      'organization := "test-org"\n' +
      'version := "0.0.2"\n';

    it('increments', () => {
      const res = sbtUpdater.bumpPackageVersion(content, '0.0.2', 'patch');
      logger.info('res1' + res);

      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(content);
    });
    it('no ops', () => {
      const res = sbtUpdater.bumpPackageVersion(content, '0.0.1', 'patch');
      logger.info('res2' + res);

      expect(res).toEqual(content);
    });
    it('updates', () => {
      const res = sbtUpdater.bumpPackageVersion(content, '0.0.1', 'minor');
      logger.info('res3' + res);

      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(content);
    });
    it('returns content if bumping errors', () => {
      const res = sbtUpdater.bumpPackageVersion(content, '0.0.2', true as any);
      logger.info('res4' + res);

      expect(res).toEqual(content);
    });
  });
});
