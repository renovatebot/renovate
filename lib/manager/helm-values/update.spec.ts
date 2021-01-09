import yaml from 'js-yaml';
import { fs } from '../../../test/util';
import * as helmValuesUpdater from './update';

describe('lib/manager/helm-values/update', () => {
  describe('.bumpPackageVersion()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      fs.readLocalFile = jest.fn();
      fs.readLocalFile.mockResolvedValueOnce(
        yaml.safeDump({
          apiVersion: 'v2',
          name: 'test',
          version: '0.0.2',
        })
      );
    });
    const content = '';
    it('increments', async () => {
      const res = await helmValuesUpdater.bumpPackageVersion(
        content,
        '0.0.2',
        'patch',
        'values.yaml'
      );
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(content);
    });
    it('no ops', async () => {
      const res = await helmValuesUpdater.bumpPackageVersion(
        content,
        '0.0.1',
        'patch',
        'values.yaml'
      );
      expect(res).toEqual(content);
    });
    it('updates', async () => {
      const res = await helmValuesUpdater.bumpPackageVersion(
        content,
        '0.0.1',
        'minor',
        'values.yaml'
      );
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(content);
    });
    it('returns content if bumping errors', async () => {
      const res = await helmValuesUpdater.bumpPackageVersion(
        content,
        '0.0.2',
        true as any,
        'values.yaml'
      );
      expect(res).toEqual(content);
    });
  });
});
