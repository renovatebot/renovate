import { tools as containerbaseTools } from '@containerbase/base';
import { knownUnsupportedToolNames, toolDefinitions } from './types.ts';

describe('util/exec/types', () => {
  it('only defines tools that Containerbase actually supports', () => {
    const unsupported = toolDefinitions
      .map(({ name }) => name)
      .filter(
        (name) =>
          !(name in containerbaseTools) &&
          !(knownUnsupportedToolNames as readonly string[]).includes(name),
      );

    if (unsupported.length) {
      throw new Error(
        `The following tools in \`toolDefinitions\` are not recognised by Containerbase: ${unsupported.join(', ')}.\n` +
          'If this is a new tool, add it to Containerbase first, see ' +
          'https://docs.renovatebot.com/docker-build-process/#adding-new-tools\n' +
          'Otherwise, remove or fix the entry in `lib/util/exec/types.ts`.',
      );
    }

    expect(unsupported).toEqual([]);
  });
});
