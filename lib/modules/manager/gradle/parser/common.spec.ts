import type { lexer } from 'good-enough-parser';
import { partial } from '../../../../../test/util';
import type { Ctx, PackageVariables } from '../types';
import {
  cleanupTempVars,
  coalesceVariable,
  interpolateString,
  loadFromTokenMap,
  storeInTokenMap,
  storeVarToken,
  stripReservedPrefixFromKeyTokens,
} from './common';

describe('modules/manager/gradle/parser/common', () => {
  let ctx: Ctx;
  const token = partial<lexer.Token>({});

  beforeEach(() => {
    ctx = {
      packageFile: '',
      fileContents: {},
      recursionDepth: 0,

      globalVars: {},
      deps: [],
      registryUrls: [],

      varTokens: [],
      tmpTokenStore: {},
      tokenMap: {},
    };
  });

  it('storeVarToken', () => {
    storeVarToken(ctx, token);
    expect(ctx.varTokens).toStrictEqual([token]);
  });

  it('storeInTokenMap', () => {
    ctx.varTokens = [token];
    storeInTokenMap(ctx, 'foo');
    expect(ctx.tokenMap).toStrictEqual({ foo: [token] });
  });

  it('loadFromTokenMap', () => {
    expect(() => loadFromTokenMap(ctx, 'foo')).toThrow(
      'Expected token foo not found'
    );

    ctx.varTokens = [token];
    storeInTokenMap(ctx, 'foo');
    expect(loadFromTokenMap(ctx, 'foo')).toStrictEqual([token]);
  });

  it('cleanupTempVars', () => {
    ctx.tokenMap['some'] = [token];
    ctx.varTokens.push(token);

    cleanupTempVars(ctx);
    expect(ctx.tokenMap).toBeEmptyObject();
    expect(ctx.varTokens).toBeEmptyArray();
  });

  it('stripReservedPrefixFromKeyTokens', () => {
    const tokenValues = ['rootProject', 'project', 'ext', 'extra', 'foo'];

    ctx.varTokens.push(
      ...tokenValues.map((value) => partial<lexer.Token>({ value }))
    );
    stripReservedPrefixFromKeyTokens(ctx);
    expect(ctx.varTokens).toStrictEqual([{ value: 'foo' }]);
  });

  it('coalesceVariable', () => {
    const tokenValues = ['foo', 'bar', 'baz', 'qux'];

    ctx.varTokens.push(
      ...tokenValues.map((value) => partial<lexer.Token>({ value }))
    );
    coalesceVariable(ctx);
    expect(ctx.varTokens).toStrictEqual([{ value: 'foo.bar.baz.qux' }]);
  });

  it('interpolateString', () => {
    expect(interpolateString([], {})).toBeEmptyString();
    expect(
      interpolateString(
        partial<lexer.Token>([
          { type: 'string-value', value: 'foo' },
          { type: 'symbol', value: 'bar' },
          { type: 'string-value', value: 'baz' },
        ]),
        {
          bar: { key: '', value: 'BAR' },
        }
      )
    ).toBe('fooBARbaz');
    expect(
      interpolateString(
        partial<lexer.Token>([{ type: 'symbol', value: 'foo' }]),
        partial<PackageVariables>()
      )
    ).toBeNull();
    expect(
      interpolateString(
        partial<lexer.Token>([{ type: '_', value: 'foo' }]),
        partial<PackageVariables>()
      )
    ).toBeNull();
  });
});
