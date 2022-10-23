import { lang, lexer, query as q } from 'good-enough-parser';
import { newlineRegex, regEx } from '../../../util/regex';
import type { PackageDependency } from '../types';
import {
  IMPLICIT_GRADLE_PLUGINS,
  REGISTRY_URLS,
  cleanupTempVars,
  coalesceVariable,
  loadFromTokenMap,
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
  handleImplicitGradlePlugin,
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
        search: q.begin<Ctx>().join(qStringValue).end(),
      })
    ),
    0,
    32
  )
  .handler(stripReservedPrefixFromKeyTokens);

const qVariableAccessIdentifier =
  qVariableAssignmentIdentifier.handler(coalesceVariable);

const qPropertyAccessIdentifier = q
  .alt(
    q.sym<Ctx>('property'),
    q
      .sym<Ctx>(/^(rootProject|project)$/)
      .op('.')
      .alt(
        q.sym('getProperty'),
        q
          .sym<Ctx>(/^(extra|ext)$/)
          .op('.')
          .sym('get')
      )
  )
  .tree({
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    search: q
      .begin<Ctx>()
      .str((ctx, node) => {
        const nodeTransformed: lexer.SymbolToken = {
          ...node,
          type: 'symbol',
        };
        storeVarToken(ctx, nodeTransformed);
        return ctx;
      })
      .end(),
  });

/*const qTemplateString = q // todo: requires https://github.com/zharinov/good-enough-parser/pull/144 to be merged
  .tree({
    type: 'string-tree',
    maxDepth: 2,
    preHandler: (ctx, tree) => {
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
  });*/

const qTemplateString = q
  .alt(
    q.str<Ctx>({
      // sym | apply(from = "${rootDir.path}")
      match: [
        qVariableAccessIdentifier.handler((ctx) => {
          ctx.tmpTokenStore.templateTokens = ctx.varTokens;
          ctx.varTokens = [];
          return ctx;
        }),
      ],
    }),
    q.str<Ctx>({
      // str + sym | apply(from = "foo/${rootDir.path}")
      match: [
        q.str((ctx: Ctx, node: lexer.Token) => {
          ctx.tmpTokenStore.templateTokens = [node];
          ctx.varTokens = [];
          return ctx;
        }),
        qVariableAccessIdentifier.handler((ctx) => {
          ctx.tmpTokenStore.templateTokens?.push(...ctx.varTokens);
          ctx.varTokens = [];
          return ctx;
        }),
      ],
    }),
    q.str<Ctx>({
      // sym + str | apply(from = "${rootDir.path}/foo")
      match: [
        qVariableAccessIdentifier.handler((ctx) => {
          ctx.tmpTokenStore.templateTokens = ctx.varTokens;
          ctx.varTokens = [];
          return ctx;
        }),
        q.str((ctx: Ctx, node: lexer.Token) => {
          ctx.tmpTokenStore.templateTokens?.push(node);
          return ctx;
        }),
      ],
    }),
    q.str<Ctx>({
      // str + sym + str | apply(from = "foo/${rootDir.path}/baz")
      preHandler: null,
      match: [
        q.str((ctx: Ctx, node: lexer.Token) => {
          ctx.tmpTokenStore.templateTokens = [node];
          return ctx;
        }),
        qVariableAccessIdentifier.handler((ctx) => {
          ctx.tmpTokenStore.templateTokens?.push(...ctx.varTokens);
          ctx.varTokens = [];
          return ctx;
        }),
        q.str((ctx: Ctx, node: lexer.Token) => {
          ctx.tmpTokenStore.templateTokens?.push(node);
          return ctx;
        }),
      ],
    }),
    q.str<Ctx>({
      // sym + str + sym | url = "${base}/${name}"
      match: [
        qVariableAccessIdentifier.handler((ctx) => {
          ctx.tmpTokenStore.templateTokens = ctx.varTokens;
          ctx.varTokens = [];
          return ctx;
        }),
        q.str((ctx: Ctx, node: lexer.Token) => {
          ctx.tmpTokenStore.templateTokens?.push(node);
          return ctx;
        }),
        qVariableAccessIdentifier.handler((ctx) => {
          ctx.tmpTokenStore.templateTokens?.push(...ctx.varTokens);
          ctx.varTokens = [];
          return ctx;
        }),
      ],
    }),
    q.str<Ctx>({
      // str + sym + str + sym + str + sym | foo:bar:$foo.$bar.$baz
      match: [
        q.str((ctx: Ctx, node: lexer.Token) => {
          ctx.tmpTokenStore.templateTokens = [node];
          ctx.varTokens = [];
          return ctx;
        }),
        qVariableAccessIdentifier.handler((ctx) => {
          ctx.tmpTokenStore.templateTokens?.push(...ctx.varTokens);
          ctx.varTokens = [];
          return ctx;
        }),
        q.str((ctx: Ctx, node: lexer.Token) => {
          ctx.tmpTokenStore.templateTokens?.push(node);
          return ctx;
        }),
        qVariableAccessIdentifier.handler((ctx) => {
          ctx.tmpTokenStore.templateTokens?.push(...ctx.varTokens);
          ctx.varTokens = [];
          return ctx;
        }),
        q.str((ctx: Ctx, node: lexer.Token) => {
          ctx.tmpTokenStore.templateTokens?.push(node);
          return ctx;
        }),
        qVariableAccessIdentifier.handler((ctx) => {
          ctx.tmpTokenStore.templateTokens?.push(...ctx.varTokens);
          ctx.varTokens = [];
          return ctx;
        }),
      ],
    })
  )
  .handler((ctx) => {
    ctx.varTokens = ctx.tmpTokenStore.templateTokens!;
    return ctx;
  });

const qGroovySingleVarAssignment = qVariableAssignmentIdentifier
  .op('=')
  .handler(coalesceVariable)
  .handler((ctx) => storeInTokenMap(ctx, 'keyToken'))
  .join(qStringValue)
  .handler((ctx) => storeInTokenMap(ctx, 'valToken'))
  .handler(handleAssignment)
  .handler(cleanupTempVars);

const qGroovyMapOfVarAssignment = q
  .sym(storeVarToken)
  .handler((ctx) => {
    ctx.tmpTokenStore.backupVarTokens = ctx.varTokens;
    return ctx;
  })
  .handler(coalesceVariable)
  .handler((ctx) => storeInTokenMap(ctx, 'keyToken'))
  .op(':')
  .join(qStringValue)
  .handler((ctx) => storeInTokenMap(ctx, 'valToken'))
  .handler(handleAssignment)
  .handler((ctx) => {
    ctx.varTokens = ctx.tmpTokenStore.backupVarTokens!;
    ctx.varTokens.pop();
    return ctx;
  });

const qGroovyMultiVarAssignment = qVariableAssignmentIdentifier
  .op('=')
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '[',
    endsWith: ']',
    search: q.alt(
      q
        .sym(storeVarToken)
        .op(':')
        .tree({
          type: 'wrapped-tree',
          maxDepth: 1,
          startsWith: '[',
          endsWith: ']',
          search: q.alt(
            q
              .sym(storeVarToken)
              .op(':')
              .tree({
                type: 'wrapped-tree',
                maxDepth: 1,
                startsWith: '[',
                endsWith: ']',
                search: qGroovyMapOfVarAssignment,
                postHandler: (ctx) => {
                  ctx.varTokens.pop();
                  return ctx;
                },
              }),
            qGroovyMapOfVarAssignment
          ),
          postHandler: (ctx) => {
            ctx.varTokens.pop();
            return ctx;
          },
        }),
      qGroovyMapOfVarAssignment
    ),
  })
  .handler(cleanupTempVars);

const qKotlinSingleVarAssignment = q
  .sym<Ctx>(/^(set|version)$/)
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

const qKotlinSingleExtraVarAssignment = q
  .sym<Ctx>('val')
  .sym(storeVarToken)
  .handler((ctx) => storeInTokenMap(ctx, 'keyToken'))
  .opt(q.op<Ctx>(':').sym('String'))
  .sym('by')
  .sym('extra')
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    search: q
      .begin<Ctx>()
      .join(qStringValue)
      .handler((ctx) => storeInTokenMap(ctx, 'valToken'))
      .handler(handleAssignment)
      .end(),
  })
  .handler(cleanupTempVars);

const qKotlinSingleMapOfVarAssignment = qStringValue
  .sym('to')
  .handler((ctx) => {
    ctx.tmpTokenStore.backupVarTokens = ctx.varTokens;
    return ctx;
  })
  .handler(coalesceVariable)
  .handler((ctx) => storeInTokenMap(ctx, 'keyToken'))
  .join(qStringValue)
  .handler((ctx) => storeInTokenMap(ctx, 'valToken'))
  .handler(handleAssignment)
  .handler((ctx) => {
    ctx.varTokens = ctx.tmpTokenStore.backupVarTokens!;
    ctx.varTokens.pop();
    return ctx;
  });

const qKotlinMultiMapOfVarAssignment = qVariableAssignmentIdentifier
  .op('=')
  .sym('mapOf')
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    search: q.alt(
      qStringValue
        .sym('to')
        .sym('mapOf')
        .tree({
          type: 'wrapped-tree',
          maxDepth: 1,
          startsWith: '(',
          endsWith: ')',
          search: q.alt(
            qStringValue
              .sym('to')
              .sym('mapOf')
              .tree({
                type: 'wrapped-tree',
                maxDepth: 1,
                startsWith: '(',
                endsWith: ')',
                search: qKotlinSingleMapOfVarAssignment,
                postHandler: (ctx) => {
                  ctx.varTokens.pop();
                  return ctx;
                },
              }),
            qKotlinSingleMapOfVarAssignment
          ),
          postHandler: (ctx) => {
            ctx.varTokens.pop();
            return ctx;
          },
        }),
      qKotlinSingleMapOfVarAssignment
    ),
  })
  .handler(cleanupTempVars);

const qDependenciesSimpleString = qStringValue
  .handler((ctx) => storeInTokenMap(ctx, 'stringToken'))
  .handler(handleDepSimpleString)
  .handler(cleanupTempVars);

const qDependenciesInterpolation = qTemplateString
  .handler((ctx) => storeInTokenMap(ctx, 'templateStringTokens'))
  .handler(handleDepInterpolation)
  .handler(cleanupTempVars);

const qDependencySet = q
  .sym<Ctx>('dependencySet', storeVarToken)
  .handler((ctx) => storeInTokenMap(ctx, 'methodName'))
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    search: q
      .begin<Ctx>()
      .sym('group')
      .op(':')
      .alt(qStringValue, qVariableAccessIdentifier, qTemplateString)
      .handler((ctx) => storeInTokenMap(ctx, 'groupId'))
      .op(',')
      .sym('version')
      .op(':')
      .alt(qStringValue, qVariableAccessIdentifier, qTemplateString)
      .handler((ctx) => storeInTokenMap(ctx, 'version'))
      .end(),
  })
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '{',
    endsWith: '}',
    search: q
      .sym<Ctx>('entry')
      .alt(
        qStringValue,
        qVariableAccessIdentifier,
        qTemplateString,
        q.tree({
          type: 'wrapped-tree',
          maxDepth: 1,
          startsWith: '(',
          endsWith: ')',
          search: q
            .begin<Ctx>()
            .alt(qStringValue, qVariableAccessIdentifier, qTemplateString)
            .end(),
        })
      )
      .handler((ctx) => storeInTokenMap(ctx, 'artifactId'))
      .handler(handleLongFormDep),
  })
  .handler(cleanupTempVars);

const qGroovyMapNotationDependencies = q
  .sym<Ctx>('group')
  .op(':')
  .alt(qStringValue, qVariableAccessIdentifier, qTemplateString)
  .handler((ctx) => storeInTokenMap(ctx, 'groupId'))
  .op(',')
  .sym('name')
  .op(':')
  .alt(qStringValue, qVariableAccessIdentifier, qTemplateString)
  .handler((ctx) => storeInTokenMap(ctx, 'artifactId'))
  .op(',')
  .sym('version')
  .op(':')
  .alt(qStringValue, qVariableAccessIdentifier, qTemplateString)
  .handler((ctx) => storeInTokenMap(ctx, 'version'))
  .handler(handleLongFormDep)
  .handler(cleanupTempVars);

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
      .alt(qStringValue, qVariableAccessIdentifier, qTemplateString)
      .handler((ctx) => storeInTokenMap(ctx, 'groupId'))
      .op(',')
      .sym('name')
      .op('=')
      .alt(qStringValue, qVariableAccessIdentifier, qTemplateString)
      .handler((ctx) => storeInTokenMap(ctx, 'artifactId'))
      .op(',')
      .sym('version')
      .op('=')
      .alt(qStringValue, qVariableAccessIdentifier, qTemplateString)
      .handler((ctx) => storeInTokenMap(ctx, 'version')),
  })
  .handler(handleLongFormDep)
  .handler(cleanupTempVars);

const qPlugins = q
  .sym(/^(id|kotlin)$/, storeVarToken)
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
  .alt(
    qStringValue,
    qTemplateString,
    qPropertyAccessIdentifier,
    qVariableAccessIdentifier
  )
  .handler((ctx) => storeInTokenMap(ctx, 'version'))
  .handler(handlePlugin)
  .handler(cleanupTempVars);

const qPredefinedRegistries = q
  .sym(regEx(`^(${Object.keys(REGISTRY_URLS).join('|')})$`), storeVarToken)
  .alt(
    q.tree({
      // mavenCentral()
      type: 'wrapped-tree',
      startsWith: '(',
      endsWith: ')',
      search: q.begin<Ctx>().end(),
    }),
    q.tree({
      // mavenCentral { ... }
      type: 'wrapped-tree',
      startsWith: '{',
      endsWith: '}',
    })
  )
  .handler((ctx) => storeInTokenMap(ctx, 'registryUrl'))
  .handler(handlePredefinedRegistryUrl)
  .handler(cleanupTempVars);

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
            search: q.alt(
              qStringValue,
              qTemplateString,
              qVariableAccessIdentifier
            ),
          }),
          q.alt(qStringValue, qTemplateString, qVariableAccessIdentifier)
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
          .alt(qStringValue, qTemplateString, qVariableAccessIdentifier)
          .handler((ctx) => storeInTokenMap(ctx, 'name')),
        q
          .sym<Ctx>('url')
          .opt(q.op('='))
          .alt(
            q.sym<Ctx>('uri').tree({
              maxDepth: 1,
              search: q.alt(
                qStringValue,
                qTemplateString,
                qVariableAccessIdentifier
              ),
            }),
            q.alt(qStringValue, qTemplateString, qVariableAccessIdentifier)
          ),
        q.sym<Ctx>('setUrl').tree({
          maxDepth: 1,
          startsWith: '(',
          endsWith: ')',
          search: q
            .begin<Ctx>()
            .alt(qStringValue, qTemplateString, qVariableAccessIdentifier)
            .end(),
        })
      ),
    })
  )
  .handler((ctx) => storeInTokenMap(ctx, 'registryUrl'))
  .handler(handleCustomRegistryUrl)
  .handler(cleanupTempVars);

const qRepositories = q.tree<Ctx>({
  type: 'wrapped-tree',
  maxDepth: 1,
  startsWith: '{',
  endsWith: '}',
  search: q.alt<Ctx>(qPredefinedRegistries, qCustomRegistryUrl),
});

const qRepositoriesWithScope = q.alt<Ctx>(
  q.sym<Ctx>('publishing').tree(),
  qRepositories
);

const qVersionCatalogVersion = q
  .op<Ctx>('.')
  .sym(/^(versionRef|version)$/, storeVarToken)
  .handler((ctx) => storeInTokenMap(ctx, 'versionType'))
  .tree({
    maxDepth: 1,
    maxMatches: 1,
    startsWith: '(',
    endsWith: ')',
    search: q
      .begin<Ctx>()
      .alt(
        // library("android-gradle", "com.android.tools.build", "gradle").version(agp)
        qVariableAccessIdentifier,
        q.str<Ctx>((ctx, node) => {
          if (loadFromTokenMap(ctx, 'versionType')[0].value === 'versionRef') {
            // library("kotlin-reflect", "org.jetbrains.kotlin", "kotlin-reflect").versionRef("kotlin")
            const node1: lexer.SymbolToken = {
              type: 'symbol',
              value: node.value,
              offset: node.offset,
              line: node.line,
              col: node.col,
              lineBreaks: node.lineBreaks,
            };
            storeVarToken(ctx, node1);
          } else {
            // library("foobar", "foo", "bar").version("1.2.3")
            storeVarToken(ctx, node);
          }

          return ctx;
        })
      )
      .handler((ctx) => storeInTokenMap(ctx, 'version'))
      .end(),
  });

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
      .alt(qStringValue, qVariableAccessIdentifier)
      .handler((ctx) => storeInTokenMap(ctx, 'groupId'))
      .op(',')
      .alt(qStringValue, qVariableAccessIdentifier)
      .handler((ctx) => storeInTokenMap(ctx, 'artifactId'))
      .end(),
  })
  .opt(qVersionCatalogVersion)
  .handler(handleLibraryDep)
  .handler(cleanupTempVars);

const qVersionCatalogAliasDependencies = q
  .sym<Ctx>('alias')
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    search: q
      .begin<Ctx>()
      .join(qStringValue)
      .handler((ctx) => storeInTokenMap(ctx, 'alias'))
      .end(),
  })
  .op('.')
  .sym('to')
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    search: q
      .begin<Ctx>()
      .alt(qStringValue, qVariableAccessIdentifier)
      .handler((ctx) => storeInTokenMap(ctx, 'groupId'))
      .op(',')
      .alt(qStringValue, qVariableAccessIdentifier)
      .handler((ctx) => storeInTokenMap(ctx, 'artifactId'))
      .end(),
  })
  .opt(qVersionCatalogVersion)
  .handler(handleLibraryDep)
  .handler(cleanupTempVars);

const qVersionCatalogs = q.alt(
  qVersionCatalogDependencies,
  qVersionCatalogAliasDependencies
);

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
      .alt(qStringValue, qVariableAccessIdentifier, qTemplateString)
      .handler((ctx) => storeInTokenMap(ctx, 'groupId'))
      .op(',')
      .alt(qStringValue, qVariableAccessIdentifier, qTemplateString)
      .handler((ctx) => storeInTokenMap(ctx, 'artifactId'))
      .op(',')
      .alt(qStringValue, qVariableAccessIdentifier, qTemplateString)
      .handler((ctx) => storeInTokenMap(ctx, 'version'))
      .end(),
  })
  .handler(handleLongFormDep)
  .handler(cleanupTempVars);

const qApplyFromFile = q
  .alt(
    qStringValue, // apply from: 'foo.gradle'
    qPropertyAccessIdentifier, // apply(from = property("foo"))
    q
      .alt(
        q
          .opt(
            q
              .sym<Ctx>(/^(rootProject|project)$/) // apply from: project.file("${somedir}/foo.gradle")
              .op('.')
          )
          .sym('file'), // apply from: file("${somedir}/foo.gradle")
        q
          .opt<Ctx>(q.sym('new')) // apply from: new File("${somedir}/foo.gradle")
          .sym('File')
      )
      .tree({
        maxDepth: 1,
        startsWith: '(',
        endsWith: ')',
        search: q
          .begin<Ctx>()
          .opt(
            q
              .alt(
                qStringValue,
                qPropertyAccessIdentifier,
                qTemplateString,
                qVariableAccessIdentifier
              )
              .op(',')
              .handler((ctx) => storeInTokenMap(ctx, 'parentPath'))
          )
          .alt(
            qStringValue,
            qPropertyAccessIdentifier,
            qTemplateString,
            qVariableAccessIdentifier
          )
          .end(),
      }),
    qTemplateString
  )
  .handler((ctx) => storeInTokenMap(ctx, 'scriptFile'));

const qApplyFrom = q
  .sym<Ctx>('apply')
  .alt(
    q // Groovy
      .sym<Ctx>('from')
      .op(':')
      .join(qApplyFromFile),
    q // Kotlin
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

const qImplicitGradlePlugin = q
  .sym(
    regEx(`^(${Object.keys(IMPLICIT_GRADLE_PLUGINS).join('|')})$`),
    storeVarToken
  )
  .handler((ctx) => storeInTokenMap(ctx, 'pluginName'))
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    maxMatches: 1,
    startsWith: '{',
    endsWith: '}',
    search: q
      .sym<Ctx>(/^(toolVersion|version)$/)
      .op('=')
      .alt(
        qStringValue,
        qPropertyAccessIdentifier,
        qTemplateString,
        qVariableAccessIdentifier
      ),
  })
  .handler((ctx) => storeInTokenMap(ctx, 'version'))
  .handler(handleImplicitGradlePlugin)
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
      qGroovyMultiVarAssignment,
      qKotlinSingleVarAssignment,
      qKotlinSingleExtraVarAssignment,
      qKotlinMultiMapOfVarAssignment,
      qDependenciesSimpleString,
      qDependenciesInterpolation,
      qDependencySet,
      qGroovyMapNotationDependencies,
      qKotlinMapNotationDependencies,
      qPlugins,
      qRepositoriesWithScope,
      qVersionCatalogs,
      qLongFormDep,
      qApplyFrom,
      qImplicitGradlePlugin
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
