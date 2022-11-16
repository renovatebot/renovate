import { lang, lexer, query as q } from 'good-enough-parser';
import { newlineRegex, regEx } from '../../../util/regex';
import type { PackageDependency } from '../types';
import {
  REGISTRY_URLS,
  cleanupTempVars,
  coalesceVariable,
  storeInTokenMap,
  storeVarToken,
  stripReservedPrefixFromKeyTokens,
} from './parser/common';
import {
  handleApplyFrom,
  handleAssignment,
  handleCustomRegistryUrl,
  handleDepInterpolation,
  handleDepSimpleString,
  handleLibraryDep,
  handleLongFormDep,
  handlePlugin,
  handlePredefinedRegistryUrl,
} from './parser/handlers';
import type {
  Ctx,
  GradleManagerData,
  PackageVariables,
  ParseGradleResult,
} from './types';
import { isDependencyString, parseDependencyString } from './utils';

const groovy = lang.createLang('groovy');

const qStringValue = q.str((ctx: Ctx, node: lexer.Token) => {
  storeVarToken(ctx, node);
  return ctx;
});

const qStringValueAsSymbol = q.str((ctx: Ctx, node: lexer.Token) => {
  const nodeTransformed: lexer.SymbolToken = {
    ...node,
    type: 'symbol',
  };
  storeVarToken(ctx, nodeTransformed);
  return ctx;
});

// foo.bar["baz"] = "1.2.3"
const qVariableAssignmentIdentifier = q
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
const qVariableAccessIdentifier =
  qVariableAssignmentIdentifier.handler(coalesceVariable);

// "foo${bar}baz"
const qTemplateString = q
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

// foo = "1.2.3"
const qGroovySingleVarAssignment = qVariableAssignmentIdentifier
  .op('=')
  .handler(coalesceVariable)
  .handler((ctx) => storeInTokenMap(ctx, 'keyToken'))
  .join(qStringValue)
  .handler((ctx) => storeInTokenMap(ctx, 'valToken'))
  .handler(handleAssignment)
  .handler(cleanupTempVars);

// set("foo", "1.2.3")
const qKotlinSingleVarAssignment = q
  .sym<Ctx>(regEx(/^(?:set|version)$/))
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    search: q
      .begin<Ctx>()
      .join(qStringValue)
      .handler((ctx) => storeInTokenMap(ctx, 'keyToken'))
      .op(',')
      .join(qStringValue)
      .handler((ctx) => storeInTokenMap(ctx, 'valToken'))
      .handler(handleAssignment)
      .end(),
  })
  .handler(cleanupTempVars);

// "foo:bar:1.2.3"
const qDependenciesSimpleString = qStringValue
  .handler((ctx) => storeInTokenMap(ctx, 'stringToken'))
  .handler(handleDepSimpleString)
  .handler(cleanupTempVars);

// "foo:bar:$baz"
const qDependenciesInterpolation = qTemplateString
  .handler((ctx) => storeInTokenMap(ctx, 'templateStringTokens'))
  .handler(handleDepInterpolation)
  .handler(cleanupTempVars);

// group: "foo", name: "bar", version: "1.2.3"
const qGroovyMapNotationDependencies = q
  .sym<Ctx>('group')
  .op(':')
  .alt(qTemplateString, qVariableAccessIdentifier)
  .handler((ctx) => storeInTokenMap(ctx, 'groupId'))
  .op(',')
  .sym('name')
  .op(':')
  .alt(qTemplateString, qVariableAccessIdentifier)
  .handler((ctx) => storeInTokenMap(ctx, 'artifactId'))
  .op(',')
  .sym('version')
  .op(':')
  .alt(qTemplateString, qVariableAccessIdentifier)
  .handler((ctx) => storeInTokenMap(ctx, 'version'))
  .handler(handleLongFormDep)
  .handler(cleanupTempVars);

// (group = "foo", name = "bar", version = "1.2.3")
const qKotlinMapNotationDependencies = q
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    search: q
      .begin<Ctx>()
      .sym('group')
      .op('=')
      .alt(qTemplateString, qVariableAccessIdentifier)
      .handler((ctx) => storeInTokenMap(ctx, 'groupId'))
      .op(',')
      .sym('name')
      .op('=')
      .alt(qTemplateString, qVariableAccessIdentifier)
      .handler((ctx) => storeInTokenMap(ctx, 'artifactId'))
      .op(',')
      .sym('version')
      .op('=')
      .alt(qTemplateString, qVariableAccessIdentifier)
      .handler((ctx) => storeInTokenMap(ctx, 'version')),
  })
  .handler(handleLongFormDep)
  .handler(cleanupTempVars);

// id "foo.bar" version "1.2.3"
// kotlin("jvm") version "1.3.71"
const qPlugins = q
  .sym(regEx(/^(?:id|kotlin)$/), storeVarToken)
  .handler((ctx) => storeInTokenMap(ctx, 'methodName'))
  .alt(
    qStringValue,
    q.tree({
      type: 'wrapped-tree',
      maxDepth: 1,
      startsWith: '(',
      endsWith: ')',
      search: q.begin<Ctx>().join(qStringValue).end(),
    })
  )
  .handler((ctx) => storeInTokenMap(ctx, 'pluginName'))
  .sym('version')
  .alt(qTemplateString, qVariableAccessIdentifier)
  .handler((ctx) => storeInTokenMap(ctx, 'version'))
  .handler(handlePlugin)
  .handler(cleanupTempVars);

// mavenCentral()
// mavenCentral { ... }
const qPredefinedRegistries = q
  .sym(regEx(`^(?:${Object.keys(REGISTRY_URLS).join('|')})$`), storeVarToken)
  .alt(
    q.tree({
      type: 'wrapped-tree',
      startsWith: '(',
      endsWith: ')',
      search: q.begin<Ctx>().end(),
    }),
    q.tree({
      type: 'wrapped-tree',
      startsWith: '{',
      endsWith: '}',
    })
  )
  .handler((ctx) => storeInTokenMap(ctx, 'registryUrl'))
  .handler(handlePredefinedRegistryUrl)
  .handler(cleanupTempVars);

// maven(url = uri("https://foo.bar/baz"))
// maven { name = some; url = "https://foo.bar/${name}" }
const qCustomRegistryUrl = q
  .sym<Ctx>('maven')
  .alt(
    q.tree<Ctx>({
      type: 'wrapped-tree',
      maxDepth: 1,
      startsWith: '(',
      endsWith: ')',
      search: q
        .begin<Ctx>()
        .opt(q.sym<Ctx>('url').op('='))
        .alt(
          q.sym<Ctx>('uri').tree({
            maxDepth: 1,
            search: q.alt(qTemplateString, qVariableAccessIdentifier),
          }),
          q.alt(qTemplateString, qVariableAccessIdentifier)
        )
        .end(),
    }),
    q.tree({
      type: 'wrapped-tree',
      maxDepth: 1,
      startsWith: '{',
      endsWith: '}',
      search: q.alt(
        q
          .sym<Ctx>('name')
          .opt(q.op('='))
          .alt(qTemplateString, qVariableAccessIdentifier)
          .handler((ctx) => storeInTokenMap(ctx, 'name')),
        q
          .sym<Ctx>('url')
          .opt(q.op('='))
          .alt(
            q.sym<Ctx>('uri').tree({
              maxDepth: 1,
              search: q.alt(qTemplateString, qVariableAccessIdentifier),
            }),
            q.alt(qTemplateString, qVariableAccessIdentifier)
          ),
        q.sym<Ctx>('setUrl').tree({
          maxDepth: 1,
          startsWith: '(',
          endsWith: ')',
          search: q
            .begin<Ctx>()
            .alt(qTemplateString, qVariableAccessIdentifier)
            .end(),
        })
      ),
    })
  )
  .handler((ctx) => storeInTokenMap(ctx, 'registryUrl'))
  .handler(handleCustomRegistryUrl)
  .handler(cleanupTempVars);

const qVersionCatalogVersion = q
  .op<Ctx>('.')
  .alt(
    // library("kotlin-reflect", "org.jetbrains.kotlin", "kotlin-reflect").versionRef("kotlin")
    q.sym<Ctx>('versionRef').tree({
      maxDepth: 1,
      startsWith: '(',
      endsWith: ')',
      search: q.begin<Ctx>().join(qStringValueAsSymbol).end(),
    }),
    // library("android-gradle", "com.android.tools.build", "gradle").version("${agp}")
    q.sym<Ctx>('version').tree({
      maxDepth: 1,
      startsWith: '(',
      endsWith: ')',
      search: q
        .begin<Ctx>()
        .alt(qTemplateString, qVariableAccessIdentifier)
        .end(),
    })
  )
  .handler((ctx) => storeInTokenMap(ctx, 'version'));

// library("foo.bar", "foo", "bar")
const qVersionCatalogDependencies = q
  .sym<Ctx>('library', storeVarToken)
  .handler((ctx) => storeInTokenMap(ctx, 'methodName'))
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    search: q
      .begin<Ctx>()
      .join(qStringValue)
      .handler((ctx) => storeInTokenMap(ctx, 'alias'))
      .op(',')
      .alt(qTemplateString, qVariableAccessIdentifier)
      .handler((ctx) => storeInTokenMap(ctx, 'groupId'))
      .op(',')
      .alt(qTemplateString, qVariableAccessIdentifier)
      .handler((ctx) => storeInTokenMap(ctx, 'artifactId'))
      .end(),
  })
  .opt(qVersionCatalogVersion)
  .handler(handleLibraryDep)
  .handler(cleanupTempVars);

// someMethod("foo", "bar", "1.2.3")
const qLongFormDep = q
  .opt<Ctx>(
    q.sym(storeVarToken).handler((ctx) => storeInTokenMap(ctx, 'methodName'))
  )
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    maxMatches: 1,
    startsWith: '(',
    endsWith: ')',
    search: q
      .begin<Ctx>()
      .alt(qTemplateString, qVariableAccessIdentifier)
      .handler((ctx) => storeInTokenMap(ctx, 'groupId'))
      .op(',')
      .alt(qTemplateString, qVariableAccessIdentifier)
      .handler((ctx) => storeInTokenMap(ctx, 'artifactId'))
      .op(',')
      .alt(qTemplateString, qVariableAccessIdentifier)
      .handler((ctx) => storeInTokenMap(ctx, 'version'))
      .end(),
  })
  .handler(handleLongFormDep)
  .handler(cleanupTempVars);

const qApplyFromFile = q
  .alt(
    qTemplateString, // apply from: 'foo.gradle'
    q
      .alt(
        q
          .opt(q.sym<Ctx>(regEx(/^(?:rootProject|project)$/)).op('.'))
          .sym('file'),
        q.opt<Ctx>(q.sym('new')).sym('File')
      )
      .tree({
        maxDepth: 1,
        startsWith: '(',
        endsWith: ')',
        search: q
          .begin<Ctx>()
          .opt(
            q
              .alt(qTemplateString, qVariableAccessIdentifier)
              .op(',')
              .handler((ctx) => storeInTokenMap(ctx, 'parentPath'))
          )
          .alt(qTemplateString, qVariableAccessIdentifier)
          .end(),
      })
  )
  .handler((ctx) => storeInTokenMap(ctx, 'scriptFile'));

const qApplyFrom = q
  .sym<Ctx>('apply')
  .alt(
    q // apply from: rootProject.file("basedir", "foo/bar.gradle")
      .sym<Ctx>('from')
      .op(':')
      .join(qApplyFromFile),
    q // apply(from = File(base, "bar.gradle"))
      .tree({
        maxDepth: 1,
        maxMatches: 1,
        startsWith: '(',
        endsWith: ')',
        search: q.begin<Ctx>().sym('from').op('=').join(qApplyFromFile).end(),
      })
  )
  .handler(handleApplyFrom)
  .handler(cleanupTempVars);

export function parseGradle(
  input: string,
  initVars: PackageVariables = {},
  packageFile = '',
  fileContents: Record<string, string | null> = {},
  recursionDepth = 0
): ParseGradleResult {
  let vars: PackageVariables = { ...initVars };
  const deps: PackageDependency<GradleManagerData>[] = [];
  const urls: string[] = [];

  const query = q.tree<Ctx>({
    type: 'root-tree',
    maxDepth: 32,
    search: q.alt<Ctx>(
      qGroovySingleVarAssignment,
      qKotlinSingleVarAssignment,
      qDependenciesSimpleString,
      qDependenciesInterpolation,
      qGroovyMapNotationDependencies,
      qKotlinMapNotationDependencies,
      qPlugins,
      qPredefinedRegistries,
      qCustomRegistryUrl,
      qVersionCatalogDependencies,
      qLongFormDep,
      qApplyFrom
    ),
  });

  const parsedResult = groovy.query(input, query, {
    packageFile,
    fileContents,
    recursionDepth,

    globalVars: initVars,
    deps: [],
    depRegistryUrls: [],

    varTokens: [],
    tmpTokenStore: {},
    tokenMap: {},
  });

  if (parsedResult) {
    deps.push(...parsedResult.deps);
    vars = { ...vars, ...parsedResult.globalVars };
    urls.push(...parsedResult.depRegistryUrls);
  }

  return { deps, urls, vars };
}

const propWord = '[a-zA-Z_][a-zA-Z0-9_]*(?:\\.[a-zA-Z_][a-zA-Z0-9_]*)*';
const propRegex = regEx(
  `^(?<leftPart>\\s*(?<key>${propWord})\\s*[= :]\\s*['"]?)(?<value>[^\\s'"]+)['"]?\\s*$`
);

export function parseProps(
  input: string,
  packageFile?: string
): { vars: PackageVariables; deps: PackageDependency<GradleManagerData>[] } {
  let offset = 0;
  const vars: PackageVariables = {};
  const deps: PackageDependency[] = [];
  for (const line of input.split(newlineRegex)) {
    const lineMatch = propRegex.exec(line);
    if (lineMatch?.groups) {
      const { key, value, leftPart } = lineMatch.groups;
      if (isDependencyString(value)) {
        const dep = parseDependencyString(value);
        if (dep) {
          deps.push({
            ...dep,
            managerData: {
              fileReplacePosition:
                offset + leftPart.length + dep.depName!.length + 1,
              packageFile,
            },
          });
        }
      } else {
        vars[key] = {
          key,
          value,
          fileReplacePosition: offset + leftPart.length,
          packageFile,
        };
      }
    }
    offset += line.length + 1;
  }
  return { vars, deps };
}
