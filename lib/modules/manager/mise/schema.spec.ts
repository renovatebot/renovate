import { codeBlock } from 'common-tags';
import { MiseFile } from './schema.ts';

describe('modules/manager/mise/schema', () => {
  describe('MiseFile', () => {
    it('defaults tools to empty object when [tools] is absent', () => {
      const content = codeBlock`
        min_version = "2024.11.1"
      `;
      expect(MiseFile.parse(content)).toEqual({
        tools: {},
        tasks: {},
        include: [],
        task_config: { includes: [] },
      });
    });

    it('defaults tools to empty object for empty TOML', () => {
      expect(MiseFile.parse('')).toEqual({
        tools: {},
        tasks: {},
        include: [],
        task_config: { includes: [] },
      });
    });

    it('parses [tools] when present', () => {
      const content = codeBlock`
        [tools]
        node = "20"
      `;
      expect(MiseFile.parse(content)).toEqual({
        tools: { node: '20' },
        tasks: {},
        include: [],
        task_config: { includes: [] },
      });
    });

    it('parses [task_config] includes when present', () => {
      const content = codeBlock`
        [task_config]
        includes = ["tasks"]
      `;
      expect(MiseFile.parse(content)).toEqual({
        tools: {},
        tasks: {},
        include: [],
        task_config: { includes: ['tasks'] },
      });
    });

    it('defaults [task_config] includes when the table is invalid', () => {
      const content = codeBlock`
        [task_config]
        includes = "not-an-array"
      `;
      expect(MiseFile.parse(content)).toEqual({
        tools: {},
        tasks: {},
        include: [],
        task_config: { includes: [] },
      });
    });
  });
});
