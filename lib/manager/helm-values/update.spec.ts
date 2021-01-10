import yaml from 'js-yaml';
import { fs } from '../../../test/util';
import * as helmValuesUpdater from './update';

describe('lib/manager/helm-values/update', () => {
  describe('.bumpPackageVersion()', () => {
    const chartContent = yaml.safeDump({
      apiVersion: 'v2',
      name: 'test',
      version: '0.0.2',
    });
    const helmValuesContent = yaml.safeDump({
      image: {
        registry: 'docker.io',
        repository: 'docker/whalesay',
        tag: '1.0.0',
      },
    });
    beforeEach(() => {
      jest.resetAllMocks();
      fs.readLocalFile = jest.fn();
      fs.readLocalFile.mockResolvedValueOnce(chartContent);
    });
    it('increments', async () => {
      const {
        bumpedContent,
        bumpedFile,
      } = await helmValuesUpdater.bumpPackageVersion(
        helmValuesContent,
        '0.0.2',
        'patch',
        'values.yaml'
      );
      expect(bumpedContent).toEqual(helmValuesContent);
      expect(bumpedFile.fileName).toEqual('Chart.yaml');
      expect(bumpedFile.newContent).toMatchSnapshot();
    });
    it('no ops', async () => {
      const {
        bumpedContent,
        bumpedFile,
      } = await helmValuesUpdater.bumpPackageVersion(
        helmValuesContent,
        '0.0.1',
        'patch',
        'values.yaml'
      );
      expect(bumpedContent).toEqual(helmValuesContent);
      expect(bumpedFile.newContent).toEqual(chartContent);
    });
    it('updates', async () => {
      const {
        bumpedContent,
        bumpedFile,
      } = await helmValuesUpdater.bumpPackageVersion(
        helmValuesContent,
        '0.0.1',
        'minor',
        'values.yaml'
      );
      expect(bumpedContent).toEqual(helmValuesContent);
      expect(bumpedFile.newContent).toMatchSnapshot();
      expect(bumpedFile.fileName).toEqual('Chart.yaml');
    });
    it('returns content if bumping errors', async () => {
      const {
        bumpedContent,
        bumpedFile,
      } = await helmValuesUpdater.bumpPackageVersion(
        helmValuesContent,
        '0.0.2',
        true as any,
        'values.yaml'
      );
      expect(bumpedContent).toEqual(helmValuesContent);
      expect(bumpedFile).toBeUndefined();
    });
  });
});
