import { codeBlock } from 'common-tags';
import { parseTomlFile } from './utils';

const miseFilename = '.mise.toml';

describe('modules/manager/mise/utils', () => {
  describe('parseTomlFile', () => {
    it('load and parse successfully', () => {
      const fileContent = codeBlock`
        [tools]
        erlang = '23.3'
        node = '16'
      `;
      const actual = parseTomlFile(fileContent, miseFilename);
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
      const actual = parseTomlFile(invalidToml, miseFilename);
      expect(actual).toBeNull();
    });

    it('invalid schema', () => {
      const content = codeBlock`
      [invalid]
      erlang = '23.3'
      node = '16'
    `;
      const actual = parseTomlFile(content, miseFilename);
      expect(actual).toBeNull();
    });
  });
});
