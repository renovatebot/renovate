import type { lexer } from 'good-enough-parser';
import { partial } from '../../../../../test/util';
import type { Ctx } from '../types';
import {
  cleanupTempVars,
  coalesceVariable,
  findVariable,
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
      tmpKotlinImportStore: [],
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
    expect(ctx.varTokens).toEqual([token, token]);

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
      'Expected token foo not found',
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
    const tokenValues = [
      'rootProject',
      'project',
      'ext',
      'extra',
      'properties',
      'foo',
    ];

    ctx.varTokens.push(
      ...tokenValues.map((value) => partial<lexer.Token>({ value })),
    );
    stripReservedPrefixFromKeyTokens(ctx);
    expect(ctx.varTokens).toStrictEqual([{ value: 'foo' }]);
  });

  it('coalesceVariable', () => {
    const tokenValues = ['foo', 'bar', 'baz', 'qux'];

    ctx.varTokens.push(
      ...tokenValues.map((value) => partial<lexer.Token>({ value })),
    );
    coalesceVariable(ctx);
    expect(ctx.varTokens).toStrictEqual([{ value: 'foo.bar.baz.qux' }]);
  });

  it('findVariable', () => {
    ctx.tmpNestingDepth = [token, token];
    ctx.globalVars = {
      foo: { key: 'foo', value: 'bar' },
      'test.foo': { key: 'test.foo', value: 'bar2' },
      'test.test.foo3': { key: 'test.test.foo3', value: 'bar3' },
    };

    expect(findVariable('unknown-global-var', ctx)).toBeUndefined();
    expect(findVariable('foo3', ctx)).toStrictEqual(
      ctx.globalVars['test.test.foo3'],
    );
    expect(findVariable('test.foo', ctx)).toStrictEqual(
      ctx.globalVars['test.foo'],
    );
    expect(findVariable('foo', ctx)).toStrictEqual(ctx.globalVars['test.foo']);

    ctx.tmpNestingDepth = [];
    expect(findVariable('foo', ctx)).toStrictEqual(ctx.globalVars['foo']);

    ctx.tmpKotlinImportStore = [[token, token]];
    expect(findVariable('test.foo3', ctx)).toStrictEqual(
      ctx.globalVars['test.test.foo3'],
    );
  });

  it('interpolateString', () => {
    expect(interpolateString([], ctx)).toBeEmptyString();
    expect(
      interpolateString(
        partial<lexer.Token>([
          { type: 'string-value', value: 'foo' },
          { type: 'symbol', value: 'bar' },
          { type: 'string-value', value: 'baz' },
        ]),
        ctx,
        {
          bar: { key: '', value: 'BAR' },
        },
      ),
    ).toBe('fooBARbaz');
    expect(
      interpolateString(
        partial<lexer.Token>([{ type: 'symbol', value: 'foo' }]),
        ctx,
      ),
    ).toBeNull();
    expect(
      interpolateString(
        partial<lexer.Token>([{ type: '_', value: 'foo' }]),
        ctx,
      ),
    ).toBeNull();
  });
});
