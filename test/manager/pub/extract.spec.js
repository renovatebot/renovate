const fs = require('fs');
const { extractAllPackageFiles } = require('../../../lib/manager/pub');

const brokenYaml = fs.readFileSync(
  'test/manager/pub/_fixtures/update.yaml',
  'utf8'
);

const packageFile = fs.readFileSync(
  'test/manager/pub/_fixtures/extract.yaml',
  'utf8'
);

describe('manager/pub', () => {
  describe('extractAllPackageFiles', () => {
    it('should return empty if package has no content', async () => {
      platform.getFile.mockReturnValueOnce(null);
      const res = await extractAllPackageFiles({}, ['random.yaml']);
      expect(res).toEqual([]);
    });
    it('should return empty if package is invalid', async () => {
      platform.getFile.mockReturnValueOnce(brokenYaml);
      const res = await extractAllPackageFiles({}, ['random.yaml']);
      expect(res).toEqual([]);
    });
    it('should return something if deps is not null', async () => {
      platform.getFile.mockReturnValueOnce('foo: bar');
      const res = await extractAllPackageFiles({}, ['random.yaml']);
      expect(res.length).toEqual(1);
    });
    it('should return valid dependencies', async () => {
      platform.getFile.mockReturnValueOnce(packageFile);
      const res = await extractAllPackageFiles({}, ['random.yaml']);
      expect(res).toMatchSnapshot();
    });
  });
});
