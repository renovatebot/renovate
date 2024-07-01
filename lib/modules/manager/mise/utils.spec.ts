import { codeBlock } from 'common-tags';
import { parseTomlFile } from './utils';

describe('modules/manager/mise/utils', () => {
  describe('parseTomlFile', () => {
    it('load and parse successfully', () => {
      const fileContent = codeBlock`
        [tools]
        erlang = '23.3'
        node = '16'
      `;
      const actual = parseTomlFile(fileContent);
      expect(actual).toMatchObject({
        tools: {
          erlang: '23.3',
          node: '16',
        },
      });
    });

    it('invalid toml', () => {
      const invalidToml = codeBlock`
      clearly: "invalid" "toml"
    `;
      const actual = parseTomlFile(invalidToml);
      expect(actual).toBeNull();
    });

    it('invalid schema', () => {
      const invalidSchema = codeBlock`
      clearly: invalid
    `;
      const actual = parseTomlFile(invalidSchema);
      expect(actual).toBeNull();
    });
  });
});
