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
      jest.resetAllMocks();
      fs.readLocalFile.mockResolvedValueOnce(chartContent);
      fs.getSiblingFileName.mockReturnValueOnce('test/Chart.yaml');
    });

    it('increments', async () => {
      const { bumpedContent, bumpedFiles } =
        await helmValuesUpdater.bumpPackageVersion(
          helmValuesContent,
          '0.0.2',
          'patch',
          'test/values.yaml',
        );
      expect(bumpedContent).toEqual(helmValuesContent);
      expect(bumpedFiles).toHaveLength(1);
      const bumpedFile = bumpedFiles![0];
      expect(bumpedFile.fileName).toBe('test/Chart.yaml');
      expect(bumpedFile.newContent).toBe(
        'apiVersion: v2\nname: test\nversion: 0.0.3\n',
      );
    });

    it('no ops', async () => {
      const { bumpedContent, bumpedFiles } =
        await helmValuesUpdater.bumpPackageVersion(
          helmValuesContent,
          '0.0.1',
          'patch',
          'values.yaml',
        );
      expect(bumpedContent).toEqual(helmValuesContent);
      expect(bumpedFiles).toHaveLength(1);
      const bumpedFile = bumpedFiles![0];
      expect(bumpedFile.newContent).toEqual(chartContent);
    });

    it('updates', async () => {
      const { bumpedContent, bumpedFiles } =
        await helmValuesUpdater.bumpPackageVersion(
          helmValuesContent,
          '0.0.1',
          'minor',
          'test/values.yaml',
        );
      expect(bumpedContent).toEqual(helmValuesContent);
      expect(bumpedFiles).toHaveLength(1);
      const bumpedFile = bumpedFiles![0];
      expect(bumpedFile.fileName).toBe('test/Chart.yaml');
      expect(bumpedFile.newContent).toBe(
        'apiVersion: v2\nname: test\nversion: 0.1.0\n',
      );
    });

    it('returns content if bumping errors', async () => {
      const { bumpedContent, bumpedFiles } =
        await helmValuesUpdater.bumpPackageVersion(
          helmValuesContent,
          '0.0.2',
          true as any,
          'values.yaml',
        );
      expect(bumpedContent).toEqual(helmValuesContent);
      expect(bumpedFiles).toBeUndefined();
    });

    it('returns content if retrieving Chart.yaml fails', async () => {
      jest.resetAllMocks();
      fs.readLocalFile.mockRejectedValueOnce(null);
      const { bumpedContent, bumpedFiles } =
        await helmValuesUpdater.bumpPackageVersion(
          helmValuesContent,
          '0.0.2',
          'minor',
          'values.yaml',
        );
      expect(bumpedContent).toEqual(helmValuesContent);
      expect(bumpedFiles).toBeUndefined();
    });
  });
});
