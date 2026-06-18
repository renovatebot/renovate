import { codeBlock } from 'common-tags';
import { MiseFile } from './schema.ts';

describe('modules/manager/mise/schema', () => {
  describe('MiseFile', () => {
    it('defaults tools to empty object when [tools] is absent', () => {
      const content = codeBlock`
        min_version = "2024.11.1"
      `;
      expect(MiseFile.parse(content)).toEqual({ tools: {} });
    });

    it('defaults tools to empty object for empty TOML', () => {
      expect(MiseFile.parse('')).toEqual({ tools: {} });
    });

    it('parses [tools] when present', () => {
      const content = codeBlock`
        [tools]
        node = "20"
      `;
      expect(MiseFile.parse(content)).toEqual({
        tools: { node: '20' },
      });
    });
  });
});
