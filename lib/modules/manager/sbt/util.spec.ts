import { sortPackageFiles } from './util';

describe('modules/manager/sbt/util', () => {
  describe('sortPackageFiles()', () => {
    it('places build.sbt first', () => {
      const packageFiles = [
        'project/build.properties',
        'project/Dependencies.scala',
        'build.sbt',
      ];
      expect(sortPackageFiles(packageFiles)).toEqual([
        'build.sbt',
        'project/build.properties',
        'project/Dependencies.scala',
      ]);
    });
  });
});
