import { readFileSync } from 'fs';
import { updateDependency } from '../../../lib/manager/esy/update';

const package1json = readFileSync(
  'test/manager/esy/_fixtures/package.1.json',
  'utf8'
);
const package2json = readFileSync(
  'test/manager/esy/_fixtures/package.1.json',
  'utf8'
);

describe('lib/manager/esy/update', () => {
  describe('updateDependency()', () => {
    it('returns null for empty upgrade', async () => {
      const content = 'some content';
      const upgrade = {};
      expect(await updateDependency(content, upgrade)).toBeNull();
    });
    it('updates a dependency correctly', async () => {
      const content = package1json;
      const upgrade = {
        depType: 'dependencies',
        depName: 'ocaml',
        currentValue: '~4.6.0',
        newValue: '5.0.0',
      };
      const res = await updateDependency(content, upgrade);
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
    });
    it('updates a dependency correctly', async () => {
      const content = package2json;
      const upgrade = {
        depType: 'dependencies',
        depName: 'ocaml',
        currentValue: '~4.6.0',
        newValue: '5.0.0',
      };
      const res = await updateDependency(content, upgrade);
      expect(res).not.toBeNull();
      expect(res).toMatchSnapshot();
    });
  });
});
