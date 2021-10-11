import { dump } from 'js-yaml';
import * as helmRequirementsUpdater from './update';

describe('manager/helm-requirements/update', () => {
  describe('.bumpPackageVersion()', () => {
    const content = dump({
      apiVersion: 'v1',
      name: 'test',
      version: '0.0.2',
    });
    it('increments', () => {
      const { bumpedContent } = helmRequirementsUpdater.bumpPackageVersion(
        content,
        '0.0.2',
        'patch'
      );
      const expected = content.replace('0.0.2', '0.0.3');
      expect(bumpedContent).toEqual(expected);
    });
    it('no ops', () => {
      const { bumpedContent } = helmRequirementsUpdater.bumpPackageVersion(
        content,
        '0.0.1',
        'patch'
      );
      expect(bumpedContent).toEqual(content);
    });
    it('updates', () => {
      const { bumpedContent } = helmRequirementsUpdater.bumpPackageVersion(
        content,
        '0.0.1',
        'minor'
      );
      const expected = content.replace('0.0.2', '0.1.0');
      expect(bumpedContent).toEqual(expected);
    });
    it('returns content if bumping errors', () => {
      const { bumpedContent } = helmRequirementsUpdater.bumpPackageVersion(
        content,
        '0.0.2',
        true as any
      );
      expect(bumpedContent).toEqual(content);
    });
  });
});
