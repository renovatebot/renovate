import { lexer, parser, query as q } from 'good-enough-parser';
import { clone } from '../../../../util/clone';
import { regEx } from '../../../../util/regex';
import type {
  Ctx,
  NonEmptyArray,
  PackageVariables,
  VariableData,
} from '../types';

export const REGISTRY_URLS = {
  google: 'https://dl.google.com/android/maven2/',
  gradlePluginPortal: 'https://plugins.gradle.org/m2/',
  jcenter: 'https://jcenter.bintray.com/',
  mavenCentral: 'https://repo.maven.apache.org/maven2',
};

export const GRADLE_PLUGINS = {
  checkstyle: ['toolVersion', 'com.puppycrawl.tools:checkstyle'],
  codenarc: ['toolVersion', 'org.codenarc:CodeNarc'],
  composeOptions: [
    'kotlinCompilerExtensionVersion',
    'androidx.compose.compiler:compiler',
  ],
  detekt: ['toolVersion', 'io.gitlab.arturbosch.detekt:detekt-core'],
  findbugs: ['toolVersion', 'com.google.code.findbugs:findbugs'],
  googleJavaFormat: [
    'toolVersion',
    'com.google.googlejavaformat:google-java-format',
  ],
  jacoco: ['toolVersion', 'org.jacoco:jacoco'],
  jmh: ['jmhVersion', 'org.openjdk.jmh:jmh-core'],
  lombok: ['version', 'org.projectlombok:lombok'],
  pmd: ['toolVersion', 'net.sourceforge.pmd:pmd-java'],
  spotbugs: ['toolVersion', 'com.github.spotbugs:spotbugs'],
};

export function storeVarToken(ctx: Ctx, node: lexer.Token): Ctx {
  ctx.varTokens.push(node);
  return ctx;
}

export function increaseNestingDepth(ctx: Ctx): Ctx {
  ctx.tmpNestingDepth.push(...ctx.varTokens);
  ctx.varTokens = [];
  return ctx;
}

export function reduceNestingDepth(ctx: Ctx): Ctx {
  ctx.tmpNestingDepth.pop();
  return ctx;
}

export function prependNestingDepth(ctx: Ctx): Ctx {
  ctx.varTokens = [...clone(ctx.tmpNestingDepth), ...ctx.varTokens];
  return ctx;
}

export function storeInTokenMap(ctx: Ctx, tokenMapKey: string): Ctx {
  ctx.tokenMap[tokenMapKey] = ctx.varTokens;
  ctx.varTokens = [];

  return ctx;
}

export function loadFromTokenMap(
  ctx: Ctx,
  tokenMapKey: string,
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
  const unwantedPrefixes = [
    'ext',
    'extra',
    'project',
    'rootProject',
    'properties',
  ];
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

export function findVariableInKotlinImport(
  name: string,
  ctx: Ctx,
  variables: PackageVariables,
): VariableData | undefined {
  if (ctx.tmpKotlinImportStore.length && name.includes('.')) {
    for (const tokens of ctx.tmpKotlinImportStore) {
      const lastToken = tokens[tokens.length - 1];
      if (lastToken && name.startsWith(`${lastToken.value}.`)) {
        const prefix = tokens
          .slice(0, -1)
          .map((token) => token.value)
          .join('.');
        const identifier = `${prefix}.${name}`;

        if (variables[identifier]) {
          return variables[identifier];
        }
      }
    }
  }

  return undefined;
}

export function findVariable(
  name: string,
  ctx: Ctx,
  variables: PackageVariables = ctx.globalVars,
): VariableData | undefined {
  if (ctx.tmpNestingDepth.length) {
    const prefixParts = ctx.tmpNestingDepth.map((token) => token.value);
    for (let idx = ctx.tmpNestingDepth.length; idx > 0; idx -= 1) {
      const prefix = prefixParts.slice(0, idx).join('.');
      const identifier = `${prefix}.${name}`;

      if (variables[identifier]) {
        return variables[identifier];
      }
    }
  }

  if (variables[name]) {
    return variables[name];
  }

  return findVariableInKotlinImport(name, ctx, variables);
}

export function interpolateString(
  childTokens: lexer.Token[],
  ctx: Ctx,
  variables: PackageVariables = ctx.globalVars,
): string | null {
  const resolvedSubstrings: string[] = [];
  for (const childToken of childTokens) {
    const type = childToken.type;
    if (type === 'string-value') {
      resolvedSubstrings.push(childToken.value);
    } else if (type === 'symbol') {
      const varData = findVariable(childToken.value, ctx, variables);
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
      }),
    ),
    0,
    32,
  )
  .handler(stripReservedPrefixFromKeyTokens);

// foo.bar["baz"] -> "foo.bar.baz"
export const qVariableAccessIdentifier = q
  .handler<Ctx>((ctx) => {
    ctx.tmpTokenStore.backupVarAccessTokens = ctx.varTokens;
    ctx.varTokens = [];
    return ctx;
  })
  .join(qVariableAssignmentIdentifier)
  .handler(coalesceVariable)
  .handler((ctx) => {
    ctx.varTokens = [
      ...ctx.tmpTokenStore.backupVarAccessTokens!,
      ...ctx.varTokens,
    ];
    delete ctx.tmpTokenStore.backupVarAccessTokens;
    return ctx;
  });

// project.ext.getProperty(...)
// extra.get(...)
export const qPropertyAccessIdentifier = q
  .opt(q.sym<Ctx>(regEx(/^(?:rootProject|project)$/)).op('.'))
  .alt(
    q.opt(q.sym<Ctx>('ext').op('.')).sym(regEx(/^(?:property|getProperty)$/)),
    q
      .sym<Ctx>(regEx(/^(?:extra|ext)$/))
      .op('.')
      .sym('get'),
  )
  .tree({
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    search: q.begin<Ctx>().join(qStringValueAsSymbol).end(),
  })
  .opt(q.sym<Ctx>('as').sym('String'));

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
      }),
    ),
  })
  .handler((ctx) => {
    ctx.varTokens = ctx.tmpTokenStore.templateTokens!;
    return ctx;
  });

// foo = "bar"
// foo + foo + "${foo}" + "foo" => "barbarbarfoo"
export const qConcatExpr = (
  ...matchers: q.QueryBuilder<Ctx, parser.Node>[]
): q.QueryBuilder<Ctx, parser.Node> =>
  q.alt(...matchers).many(q.op<Ctx>('+').alt(...matchers), 0, 32);

export const qValueMatcher = qConcatExpr(
  qTemplateString,
  qPropertyAccessIdentifier,
  qVariableAccessIdentifier,
);

// import foo.bar
// runtimeOnly("some:foo:${bar.bazVersion}")
export const qKotlinImport = q
  .sym<Ctx>('import')
  .join(qVariableAssignmentIdentifier)
  .handler((ctx) => {
    ctx.tmpKotlinImportStore.push(ctx.varTokens);
    return ctx;
  })
  .handler(cleanupTempVars);
