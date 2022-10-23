import type { lexer } from 'good-enough-parser';
import type { Ctx, NonEmptyArray, PackageVariables } from '../types';

export const REGISTRY_URLS = {
  google: 'https://dl.google.com/android/maven2/',
  gradlePluginPortal: 'https://plugins.gradle.org/m2/',
  jcenter: 'https://jcenter.bintray.com/',
  mavenCentral: 'https://repo.maven.apache.org/maven2',
};

export const IMPLICIT_GRADLE_PLUGINS = {
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
  'stages', // https://github.com/ajoberstar/reckon
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
