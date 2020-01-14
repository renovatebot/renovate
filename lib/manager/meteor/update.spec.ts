import { readFileSync } from 'fs';
import { resolve } from 'path';
import { updateDependency } from './update';

function readFixture(fixture: string) {
  return readFileSync(resolve(__dirname, `./__fixtures__/${fixture}`), 'utf8');
}

const input01Content = readFixture('package-1.js');
const input02Content = readFixture('package-2.js');

describe('workers/branch/package-js', () => {
  describe('.updateDependency(fileContent, depName, currentValue, newValue)', () => {
    it('replaces a dependency value', () => {
      const updateOptions = {
        depName: 'xmldom',
        currentValue: '0.1.19',
        newValue: '0.22.1',
      };
      const testContent = updateDependency({
        fileContent: input01Content,
        updateOptions,
      });
      expect(testContent).toMatchSnapshot();
    });
    it('handles alternative quotes and white space', () => {
      const updateOptions = {
        depName: 'xmldom',
        currentValue: '0.1.19',
        newValue: '0.22.1',
      };
      const testContent = updateDependency({
        fileContent: input02Content,
        updateOptions,
      });
      expect(testContent).toMatchSnapshot();
    });
    it('handles the case where the desired version is already supported', () => {
      const updateOptions = {
        depName: 'query-string',
        currentValue: '0.2.0',
        newValue: '0.2.0',
      };
      const testContent = updateDependency({
        fileContent: input01Content,
        updateOptions,
      });
      expect(testContent).toEqual(input01Content);
    });
  });
});
