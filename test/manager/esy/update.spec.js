import { readFileSync } from 'fs';
import { updateDependency } from '../../../lib/manager/esy/update';

const esy1json = readFileSync('test/manager/esy/_fixtures/esy.1.json', 'utf8');
const esy2json = readFileSync('test/manager/esy/_fixtures/esy.2.json', 'utf8');

describe('lib/manager/esy/update', () => {
  describe('updateDependency()', () => {
    it('returns null for empty upgrade', async () => {
      const content = 'some content';
      const upgrade = {};
      expect(await updateDependency(content, upgrade)).toBeNull();
    });
    it('updates a dependency correctly', async () => {
      const content = esy1json;
      const upgrade = {
        depType: 'dependencies',
        depName: 'ocaml',
        currentValue: '~4.6.0',
        newValue: '5.0.0',
      };
      const res = await updateDependency(content, upgrade);
      expect(res).not.toBeNull();
      expect(res).not.toMatch(content);
      expect(res).toMatchSnapshot();
    });
    it('updates a dependency correctly', async () => {
      const content = esy2json;
      const upgrade = {
        depType: 'dependencies',
        depName: 'ocaml',
        currentValue: '~4.6.0',
        newValue: '5.0.0',
      };
      const res = await updateDependency(content, upgrade);
      expect(res).not.toBeNull();
      expect(res).not.toMatch(content);
      expect(res).toMatchSnapshot();
    });
    it('returns unchanged content if newValue === currentValue ', async () => {
      const content = esy2json;
      const upgrade = {
        depType: 'dependencies',
        depName: 'ocaml',
        currentValue: '~4.6.0',
        newValue: '~4.6.0',
      };
      const res = await updateDependency(content, upgrade);
      expect(res).toMatch(content);
    });
    it('returns unchanged content if depName is not found', async () => {
      const content = `{
  "name": "hello-reason",
  "version": "0.1.0",
  "description": "Example Reason Esy Project",
  "license": "MIT",
  "dependencies": {
    "foo": "1.2.3"
  }
}`;
      const upgrade = {
        depType: 'dependencies',
        depName: 'will_not_be_found',
        currentValue: '1.2.4',
        newValue: '2.0.0',
      };
      const res = await updateDependency(content, upgrade);
      expect(res).not.toBeNull();
      expect(res).toMatch(content);
    });
    it('updates correctly if there are two dependencies with the same depName in different sections', async () => {
      const content = `{
  "name": "hello-reason",
  "version": "0.1.0",
  "description": "Example Reason Esy Project",
  "license": "MIT",
  "dependencies": {
    "foo": "1.2.3"
  },
  "devDependencies": {
    "foo": "1.2.4"
  }
}`;
      const upgrade = {
        depType: 'devDependencies',
        depName: 'foo',
        currentValue: '1.2.4',
        newValue: '2.0.0',
      };
      const res = await updateDependency(content, upgrade);
      expect(res).not.toBeNull();
      expect(res).not.toMatch(content);
      expect(res).toMatchSnapshot();
    });
    it('updates correctly if there are two dependencies with the same version in the same section', async () => {
      const content = `{
  "name": "hello-reason",
  "version": "0.1.0",
  "description": "Example Reason Esy Project",
  "license": "MIT",
  "dependencies": {
    "foo": "1.2.3",
    "bar": "1.2.3"
  }
}`;
      const upgrade = {
        depType: 'dependencies',
        depName: 'bar',
        currentValue: '1.2.3',
        newValue: '2.0.0',
      };
      const res = await updateDependency(content, upgrade);
      expect(res).not.toBeNull();
      expect(res).not.toMatch(content);
      expect(res).toMatchSnapshot();
    });
  });
});
