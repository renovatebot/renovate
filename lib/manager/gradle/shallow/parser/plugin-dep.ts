import { lexer as lex, query as q } from 'good-enough-parser';
import { regEx } from '../../../../util/regex';
import { PackageDependency } from '../../../types';
import { GradleManagerData } from '../../types';
import { cleanupContext } from './common';
import { GradleContext } from './types';

function handlePluginName(
  ctx: GradleContext,
  { value }: lex.StringValueToken
): GradleContext {
  ctx.groupId = ctx.groupId ? `${ctx.groupId}.${value}` : value;
  ctx.artifactId = `${ctx.groupId}.gradle.plugin`;
  return ctx;
}

export const pluginQuery = q
  .sym<GradleContext>(regEx(/^id|kotlin$/), (ctx, { value }) => {
    if (value === 'kotlin') {
      ctx.groupId = 'org.jetbrains.kotlin';
    }
    return ctx;
  })
  .alt(
    q.str(handlePluginName),
    q.tree<GradleContext>({
      maxDepth: 1,
      search: q.begin<GradleContext>().str(handlePluginName).end(),
    })
  )
  .sym('version')
  .alt(
    q.str((ctx, { value: currentValue, offset: fileReplacePosition }) => {
      const depName = ctx.artifactId.replace(regEx(/\.gradle\.plugin$/), '');
      const dep: PackageDependency<GradleManagerData> = {
        depName,
        lookupName: `${ctx.groupId}:${ctx.artifactId}`,
        currentValue,
        managerData: {
          packageFile: ctx.packageFile,
          fileReplacePosition,
        },
      };

      ctx.result.deps.push(dep);
      return cleanupContext(ctx);
    }),
    q.sym((ctx, { value }) => {
      const varData = ctx.result.vars[value];
      if (varData) {
        const currentValue = varData.value;
        const packageFile = varData.packageFile;
        const fileReplacePosition = varData.fileReplacePosition;

        const depName = ctx.artifactId.replace(regEx(/\.gradle\.plugin$/), '');

        const dep: PackageDependency<GradleManagerData> = {
          depName,
          lookupName: `${ctx.groupId}:${ctx.artifactId}`,
          currentValue,
          managerData: {
            packageFile,
            fileReplacePosition,
          },
        };

        ctx.result.deps.push(dep);
      }
      return cleanupContext(ctx);
    })
  );
