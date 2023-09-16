import { codeBlock } from 'common-tags';
import { parsePubspec, parsePubspecLock } from './utils';

describe('modules/manager/pub/utils', () => {
  const fileName = 'fileName';
  const invalidYaml = codeBlock`
    clearly: "invalid" "yaml"
  `;
  const invalidSchema = codeBlock`
    clearly: invalid
  `;

  describe('parsePubspec', () => {
    it('load and parse successfully', () => {
      const fileContent = codeBlock`
        environment:
          sdk: ">=3.0.0 <4.0.0"
          flutter: ">=3.10.0"
        dependencies:
          dep1: 1.0.0
        dev_dependencies:
          dep2: 1.0.1
      `;
      const actual = parsePubspec(fileName, fileContent);
      expect(actual).toMatchObject({
        environment: { sdk: '>=3.0.0 <4.0.0', flutter: '>=3.10.0' },
        dependencies: { dep1: '1.0.0' },
        dev_dependencies: { dep2: '1.0.1' },
      });
    });

    it('invalid yaml', () => {
      const actual = parsePubspec(fileName, invalidYaml);
      expect(actual).toBeNull();
    });

    it('invalid schema', () => {
      const actual = parsePubspec(fileName, invalidSchema);
      expect(actual).toBeNull();
    });
  });

  describe('parsePubspeckLock', () => {
    it('load and parse successfully', () => {
      const pubspecLock = codeBlock`
        sdks:
          dart: ">=3.0.0 <4.0.0"
          flutter: ">=3.10.0"
      `;
      const actual = parsePubspecLock(fileName, pubspecLock);
      expect(actual).toMatchObject({
        sdks: { dart: '>=3.0.0 <4.0.0', flutter: '>=3.10.0' },
      });
    });

    it('invalid yaml', () => {
      const actual = parsePubspecLock(fileName, invalidYaml);
      expect(actual).toBeNull();
    });

    it('invalid schema', () => {
      const actual = parsePubspecLock(fileName, invalidSchema);
      expect(actual).toBeNull();
    });
  });
});
