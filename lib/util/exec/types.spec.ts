import { tools as containerbaseTools } from '@renovatebot/base-image';
import { toolDefinitionDocumentation } from './types.ts';

describe('util/exec/types', () => {
  it('only defines tools that Containerbase actually supports', () => {
    const unsupported = toolDefinitionDocumentation
      .map(({ name }) => name)
      .filter((name) => !(name in containerbaseTools));

    if (unsupported.length) {
      throw new Error(
        `There are ${unsupported.length} tools in \`toolDefinitions\` that aren't supported by the current version of Containerbase: ${unsupported.join(', ')}.\n` +
          "If you're adding a new tool, you need to add it to Containerbase first - see " +
          'https://docs.renovatebot.com/docker-build-process/#adding-new-tools',
      );
    }

    expect(unsupported).toEqual([]);
  });
});
