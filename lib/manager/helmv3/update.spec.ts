import yaml from 'js-yaml';
import { getName } from '../../../test/util';
import * as helmv3Updater from './update';

describe(getName(__filename), () => {
  describe('.bumpPackageVersion()', () => {
    const content = yaml.safeDump({
      apiVersion: 'v2',
      name: 'test',
      version: '0.0.2',
    });
    it('increments', () => {
      const { bumpedContent } = helmv3Updater.bumpPackageVersion(
        content,
        '0.0.2',
        'patch'
      );
      expect(bumpedContent).toMatchSnapshot();
      expect(bumpedContent).not.toEqual(content);
    });
    it('no ops', () => {
      const { bumpedContent } = helmv3Updater.bumpPackageVersion(
        content,
        '0.0.1',
        'patch'
      );
      expect(bumpedContent).toEqual(content);
    });
    it('updates', () => {
      const { bumpedContent } = helmv3Updater.bumpPackageVersion(
        content,
        '0.0.1',
        'minor'
      );
      expect(bumpedContent).toMatchSnapshot();
      expect(bumpedContent).not.toEqual(content);
    });
    it('returns content if bumping errors', () => {
      const { bumpedContent } = helmv3Updater.bumpPackageVersion(
        content,
        '0.0.2',
        true as any
      );
      expect(bumpedContent).toEqual(content);
    });
  });
});
