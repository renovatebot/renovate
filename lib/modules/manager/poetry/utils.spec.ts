import { codeBlock } from 'common-tags';
import { parsePoetry } from './utils';

describe('modules/manager/poetry/utils', () => {
  const fileName = 'fileName';

  describe('parsePoetry', () => {
    it('load and parse successfully', () => {
      const fileContent = codeBlock`
        [tool.poetry.dependencies]
        dep1 = "1.0.0"
        [tool.poetry.group.dev.dependencies]
        dep2 = "1.0.1"
      `;
      const actual = parsePoetry(fileName, fileContent);
      expect(actual).toMatchObject({
        tool: {
          poetry: {
            dependencies: { dep1: { depName: 'dep1' } },
            group: { dev: { dependencies: { dep2: { depName: 'dep2' } } } },
          },
        },
      });
    });

    it('invalid toml', () => {
      const actual = parsePoetry(fileName, 'clearly_invalid');
      expect(actual).toBeNull();
    });

    it('invalid schema', () => {
      const fileContent = codeBlock`
        [tool.poetry.dependencies]:
        dep1 = 1
      `;
      const actual = parsePoetry(fileName, fileContent);
      expect(actual).toBeNull();
    });
  });
});
