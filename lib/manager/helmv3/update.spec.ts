import yaml from 'js-yaml';
import * as helmv3Updater from './update';

describe('lib/manager/helmv3/update', () => {
  describe('.bumpPackageVersion()', () => {
    const content = yaml.safeDump({
      apiVersion: 'v2',
      name: 'test',
      version: '0.0.2',
    });
    it('increments', () => {
      const res = helmv3Updater.bumpPackageVersion(content, '0.0.2', 'patch');
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(content);
    });
    it('no ops', () => {
      const res = helmv3Updater.bumpPackageVersion(content, '0.0.1', 'patch');
      expect(res).toEqual(content);
    });
    it('updates', () => {
      const res = helmv3Updater.bumpPackageVersion(content, '0.0.1', 'minor');
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(content);
    });
    it('returns content if bumping errors', () => {
      const res = helmv3Updater.bumpPackageVersion(
        content,
        '0.0.2',
        true as any
      );
      expect(res).toEqual(content);
    });
  });
});
