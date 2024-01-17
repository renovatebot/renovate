import yaml from 'js-yaml';
import { fs } from '../../../../test/util';
import * as helmValuesUpdater from './update';

jest.mock('../../../util/fs');

describe('modules/manager/helm-values/update', () => {
  describe('.bumpPackageVersion()', () => {
    const chartContent = yaml.dump({
      apiVersion: 'v2',
      name: 'test',
      version: '0.0.2',
    });
    const helmValuesContent = yaml.dump({
      image: {
        registry: 'docker.io',
        repository: 'docker/whalesay',
        tag: '1.0.0',
      },
    });

    beforeEach(() => {
      fs.readLocalFile.mockResolvedValueOnce(chartContent);
    });

    it('increments', async () => {
      const { bumpedContent } = await helmValuesUpdater.bumpPackageVersion(
        helmValuesContent,
        '0.0.2',
        'patch',
        'test/values.yaml',
      );
      expect(bumpedContent).toEqual(helmValuesContent);
    });

    it('no ops', async () => {
      const { bumpedContent } = await helmValuesUpdater.bumpPackageVersion(
        helmValuesContent,
        '0.0.1',
        'patch',
        'values.yaml',
      );
      expect(bumpedContent).toEqual(helmValuesContent);
    });

    it('updates', async () => {
      const { bumpedContent } = await helmValuesUpdater.bumpPackageVersion(
        helmValuesContent,
        '0.0.1',
        'minor',
        'test/values.yaml',
      );
      expect(bumpedContent).toEqual(helmValuesContent);
    });

    it('returns content if bumping errors', async () => {
      const { bumpedContent } = await helmValuesUpdater.bumpPackageVersion(
        helmValuesContent,
        '0.0.2',
        true as any,
        'values.yaml',
      );
      expect(bumpedContent).toEqual(helmValuesContent);
    });

    it('returns content if retrieving Chart.yaml fails', async () => {
      fs.readLocalFile.mockReset();
      fs.readLocalFile.mockRejectedValueOnce(null);
      const { bumpedContent } = await helmValuesUpdater.bumpPackageVersion(
        helmValuesContent,
        '0.0.2',
        'minor',
        'values.yaml',
      );
      expect(bumpedContent).toEqual(helmValuesContent);
    });
  });
});
