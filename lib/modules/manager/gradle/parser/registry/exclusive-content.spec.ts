import { codeBlock } from 'common-tags';
import { lang } from 'good-enough-parser';
import { expect } from 'vitest';
import type { Ctx } from '../../types';
import { qExclusiveContent } from './exclusive-content';

describe('modules/manager/gradle/parser/registry/exclusive-content', () => {
  const groovy = lang.createLang('groovy');

  let ctx: Ctx;

  beforeEach(() => {
    ctx = {
      packageFile: '',
      fileContents: {},
      recursionDepth: 0,

      globalVars: {},
      deps: [],
      registryUrls: [],

      varTokens: [],
      tmpKotlinImportStore: [],
      tmpNestingDepth: [],
      tmpExclusiveRegistryUrls: [],
      tmpRegistryContent: [],
      tmpTokenStore: {},
      tokenMap: {},
    };
  });

  it('populates registryUrls with exclusive registries', () => {
    const input = codeBlock`
        exclusiveContent {
          forRepository {
            maven("https://foo.bar/baz")
          }
          filter {
            includeGroup("com.example")
          }
        }
      `;

    const result = groovy.query(input, qExclusiveContent, ctx);

    expect(result?.registryUrls).toStrictEqual([
      {
        registryUrl: 'https://foo.bar/baz',
        scope: 'dep',
        type: 'exclusive',
        content: [
          { mode: 'include', matcher: 'simple', groupId: 'com.example' },
        ],
      },
    ]);
  });

  // TODO: Add more tests
});
