import { PyProject } from './schema.ts';

describe('modules/manager/pep621/schema', () => {
  describe('UvConfig', () => {
    it('handles exclude-newer as Date object', () => {
      const result = PyProject.parse({
        tool: {
          uv: { 'exclude-newer': new Date('2026-03-05T00:00:00.000Z') },
        },
      });
      expect(result.tool?.uv?.['exclude-newer']).toBe(
        '2026-03-05T00:00:00.000Z',
      );
    });
  });
});
