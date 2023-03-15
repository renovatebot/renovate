import type { lexer } from 'good-enough-parser';
import { partial } from '../../../../../test/util';
import type { Ctx, PackageVariables } from '../types';
import {
  cleanupTempVars,
  coalesceVariable,
  increaseNestingDepth,
  interpolateString,
  loadFromTokenMap,
  prependNestingDepth,
  reduceNestingDepth,
  storeInTokenMap,
  storeVarToken,
  stripReservedPrefixFromKeyTokens,
} from './common';

describe('modules/manager/gradle/parser/common', () => {
  let ctx: Ctx;
  const token = partial<lexer.Token>({ value: 'test' });

  beforeEach(() => {
    ctx = {
      packageFile: '',
      fileContents: {},
      recursionDepth: 0,

      globalVars: {},
      deps: [],
      registryUrls: [],

      varTokens: [],
      tmpNestingDepth: [],
      tmpTokenStore: {},
      tokenMap: {},
    };
  });

  it('storeVarToken', () => {
    storeVarToken(ctx, token);
    expect(ctx.varTokens).toStrictEqual([token]);
  });

  it('increaseNestingDepth', () => {
    ctx.tmpNestingDepth = ctx.varTokens = [token];
    increaseNestingDepth(ctx);
    expect(ctx).toMatchObject({
      tmpNestingDepth: [token, token],
      varTokens: [],
    });
  });

  it('reduceNestingDepth', () => {
    ctx.tmpNestingDepth = [token, token];
    reduceNestingDepth(ctx);
    expect(ctx.tmpNestingDepth).toHaveLength(1);
  });

  it('prependNestingDepth', () => {
    ctx.tmpNestingDepth = ctx.varTokens = [token];
    prependNestingDepth(ctx);
    expect(ctx.varTokens).toStrictEqual([token, token]);

    coalesceVariable(ctx);
    expect(ctx).toMatchObject({
      tmpNestingDepth: [{ value: 'test' }],
      varTokens: [{ value: 'test.test' }],
    });
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
