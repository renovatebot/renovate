import { Fixtures } from '../../../../test/fixtures';
import * as bundlerUpdater from './update';

const readFixture = (x: string): string => Fixtures.get(x, '.');
const gemfileRails = readFixture('Gemfile.rails');

describe('modules/manager/bundler/update', () => {
  describe('.updateDependency(fileContent, depType, depName, newValue)', () => {
    it('replaces a dependency value', () => {
      const upgrade = {
        depName: 'rake',
        newValue: '>= 13.0',
      };
      const testContent = bundlerUpdater.updateDependency({
        fileContent: gemfileRails,
        upgrade,
      });
      expect(testContent).toMatchSnapshot();
    });

    it('replaces a single constraint with multiple constraints', () => {
      const upgrade = {
        depName: 'rack-cache',
        newValue: '~> 1.12, >= 1.12.1',
      };
      const testContent = bundlerUpdater.updateDependency({
        fileContent: gemfileRails,
        upgrade,
      });
      expect(testContent).toMatchSnapshot();
    });

    it('replaces multiple constraints with a single one', () => {
      const upgrade = {
        depName: 'listen',
        newValue: '~> 3.0',
      };
      const testContent = bundlerUpdater.updateDependency({
        fileContent: gemfileRails,
        upgrade,
      });
      expect(testContent).toMatchSnapshot();
    });

    it('replaces multiple constraints with other multiple constraints', () => {
      const upgrade = {
        depName: 'listen',
        newValue: '>= 4.0, < 5',
      };
      const testContent = bundlerUpdater.updateDependency({
        fileContent: gemfileRails,
        upgrade,
      });
      expect(testContent).toMatchSnapshot();
    });
  });
});
