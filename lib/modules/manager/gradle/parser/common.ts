import { lexer, query as q } from 'good-enough-parser';
import { regEx } from '../../../../util/regex';
import type { Ctx, NonEmptyArray, PackageVariables } from '../types';

export const REGISTRY_URLS = {
  google: 'https://dl.google.com/android/maven2/',
  gradlePluginPortal: 'https://plugins.gradle.org/m2/',
  jcenter: 'https://jcenter.bintray.com/',
  mavenCentral: 'https://repo.maven.apache.org/maven2',
};

export const GRADLE_PLUGINS = {
  checkstyle: 'com.puppycrawl.tools:checkstyle',
  codenarc: 'org.codenarc:CodeNarc',
  detekt: 'io.gitlab.arturbosch.detekt:detekt-core',
  findbugs: 'com.google.code.findbugs:findbugs',
  googleJavaFormat: 'com.google.googlejavaformat:google-java-format',
  jacoco: 'org.jacoco:jacoco',
  lombok: 'org.projectlombok:lombok',
  pmd: 'net.sourceforge.pmd:pmd-java',
  spotbugs: 'com.github.spotbugs:spotbugs',
};

export const ANNOYING_METHODS: ReadonlySet<string> = new Set([
  'createXmlValueRemover',
  'events',
  'args',
  'arrayOf',
  'listOf',
  'mutableListOf',
  'setOf',
  'mutableSetOf',
  'stages', // https://github.com/ajoberstar/reckon,
  'mapScalar', // https://github.com/apollographql/apollo-kotlin
]);

export function storeVarToken(ctx: Ctx, node: lexer.Token): Ctx {
  ctx.varTokens.push(node);
  return ctx;
}

export function storeInTokenMap(ctx: Ctx, tokenMapKey: string): Ctx {
  ctx.tokenMap[tokenMapKey] = ctx.varTokens;
  ctx.varTokens = [];

  return ctx;
}

export function loadFromTokenMap(
  ctx: Ctx,
  tokenMapKey: string
): NonEmptyArray<lexer.Token> {
  const tokens = ctx.tokenMap[tokenMapKey];
  if (!tokens) {
    throw new Error(`Expected token ${tokenMapKey} not found`);
  }

  return tokens as NonEmptyArray<lexer.Token>;
}

export function cleanupTempVars(ctx: Ctx): Ctx {
  ctx.tokenMap = {};
  ctx.varTokens = [];

  return ctx;
}

export function stripReservedPrefixFromKeyTokens(ctx: Ctx): Ctx {
  const unwantedPrefixes = ['ext', 'extra', 'project', 'rootProject'];
  while (
    ctx.varTokens.length > 1 && // ensures there will be always at least one token
    ctx.varTokens[0] &&
    unwantedPrefixes.includes(ctx.varTokens[0].value)
  ) {
    ctx.varTokens.shift();
  }

  return ctx;
}

export function coalesceVariable(ctx: Ctx): Ctx {
  if (ctx.varTokens.length > 1) {
    ctx.varTokens[0]!.value = ctx.varTokens
      .map((token) => token.value)
      .join('.');
    ctx.varTokens.length = 1;
  }

  return ctx;
}

export function interpolateString(
  childTokens: lexer.Token[],
  variables: PackageVariables
): string | null {
  const resolvedSubstrings: string[] = [];
  for (const childToken of childTokens) {
    const type = childToken.type;
    if (type === 'string-value') {
      resolvedSubstrings.push(childToken.value);
    } else if (type === 'symbol') {
      const varData = variables[childToken.value];
      if (varData) {
        resolvedSubstrings.push(varData.value);
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  return resolvedSubstrings.join('');
}

export const qStringValue = q.str((ctx: Ctx, node: lexer.Token) => {
  storeVarToken(ctx, node);
  return ctx;
});

export const qStringValueAsSymbol = q.str((ctx: Ctx, node: lexer.Token) => {
  const nodeTransformed: lexer.SymbolToken = {
    ...node,
    type: 'symbol',
  };
  storeVarToken(ctx, nodeTransformed);
  return ctx;
});

// foo.bar["baz"] = "1.2.3"
export const qVariableAssignmentIdentifier = q
  .sym(storeVarToken)
  .many(
    q.alt(
      q.op<Ctx>('.').sym(storeVarToken),
      q.tree<Ctx>({
        type: 'wrapped-tree',
        maxDepth: 1,
        startsWith: '[',
        endsWith: ']',
        search: q.begin<Ctx>().join(qStringValueAsSymbol).end(),
      })
    ),
    0,
    32
  )
  .handler(stripReservedPrefixFromKeyTokens);

// foo.bar["baz"] -> "foo.bar.baz"
export const qVariableAccessIdentifier =
  qVariableAssignmentIdentifier.handler(coalesceVariable);

// project.ext.getProperty(...)
// extra.get(...)
export const qPropertyAccessIdentifier = q
  .opt(q.sym<Ctx>(regEx(/^(?:rootProject|project)$/)).op('.'))
  .alt(
    q.opt(q.sym<Ctx>('ext').op('.')).sym(regEx(/^(?:property|getProperty)$/)),
    q
      .sym<Ctx>(regEx(/^(?:extra|ext)$/))
      .op('.')
      .sym('get')
  )
  .tree({
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    search: q.begin<Ctx>().join(qStringValueAsSymbol).end(),
  });

// "foo${bar}baz"
export const qTemplateString = q
  .tree({
    type: 'string-tree',
    maxDepth: 2,
    preHandler: (ctx) => {
      ctx.tmpTokenStore.templateTokens = [];
      return ctx;
    },
    search: q.alt(
      qStringValue.handler((ctx) => {
        ctx.tmpTokenStore.templateTokens?.push(...ctx.varTokens);
        ctx.varTokens = [];
        return ctx;
      }),
      qPropertyAccessIdentifier.handler((ctx) => {
        ctx.tmpTokenStore.templateTokens?.push(...ctx.varTokens);
        ctx.varTokens = [];
        return ctx;
      }),
      qVariableAccessIdentifier.handler((ctx) => {
        ctx.tmpTokenStore.templateTokens?.push(...ctx.varTokens);
        ctx.varTokens = [];
        return ctx;
      })
    ),
  })
  .handler((ctx) => {
    ctx.varTokens = ctx.tmpTokenStore.templateTokens!;
    return ctx;
  });
