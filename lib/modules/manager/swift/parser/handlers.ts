import { detectPlatform } from '../../../../util/common.ts';
import { regEx } from '../../../../util/regex.ts';
import { GitTagsDatasource } from '../../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../../datasource/gitlab-tags/index.ts';
import type { PackageDependency } from '../../types.ts';
import type { Ctx } from '../types.ts';

export function emptyCtx(source: string): Ctx {
  return {
    source,
    deps: [],
    currentState: {},
  };
}

export function storeUrl(ctx: Ctx, url: string): Ctx {
  ctx.currentState.url = url;
  return ctx;
}

export function storeVersionValue(ctx: Ctx, version: string): Ctx {
  ctx.currentState.tmpVersionValue = version;
  return ctx;
}

export function storeVersionOffset(
  ctx: Ctx,
  opts: {
    start?: number;
    end?: number;
    overwritesStart?: boolean;
    overwritesEnd?: boolean;
  },
): Ctx {
  const { start, end, overwritesStart = true, overwritesEnd = true } = opts;
  if (start !== undefined) {
    ctx.currentState.tmpVersionOffsetStart = overwritesStart
      ? start
      : (ctx.currentState.tmpVersionOffsetStart ?? start);
  }
  if (end !== undefined) {
    ctx.currentState.tmpVersionOffsetEnd = overwritesEnd
      ? end
      : (ctx.currentState.tmpVersionOffsetEnd ?? end);
  }
  return ctx;
}

export function handlePackageDependency(ctx: Ctx): Ctx {
  const { url = null } = ctx.currentState;

  const dep = parseUrl(url);
  if (!dep) {
    return ctx;
  }

  const { tmpVersionValue, tmpVersionOffsetStart, tmpVersionOffsetEnd } =
    ctx.currentState;

  // istanbul ignore else
  if (tmpVersionValue) {
    dep.currentValue = tmpVersionValue;
  } else if (tmpVersionOffsetStart && tmpVersionOffsetEnd) {
    dep.currentValue = ctx.source.substring(
      tmpVersionOffsetStart,
      tmpVersionOffsetEnd,
    );
  } else {
    dep.skipReason = 'unspecified-version';
  }

  ctx.deps.push(dep);
  return ctx;
}

export function resetState(ctx: Ctx): Ctx {
  ctx.currentState = {};
  return ctx;
}

function parseUrl(url: string | null): PackageDependency | null {
  // istanbul ignore if
  if (!url) {
    return null;
  }
  try {
    const parsedUrl = new URL(url);
    const { host, pathname, protocol } = parsedUrl;
    const platform = detectPlatform(url);
    if (platform === 'github' || platform === 'gitlab') {
      const depName = pathname
        .replace(regEx(/^\//), '')
        .replace(regEx(/\.git$/), '')
        .replace(regEx(/\/$/), '');
      const datasource =
        platform === 'github'
          ? GithubTagsDatasource.id
          : GitlabTagsDatasource.id;

      const isGitHubPublic = host === 'github.com';
      const isGitLabPublic = host === 'gitlab.com';

      if (!isGitHubPublic && !isGitLabPublic) {
        const baseUrl = `${protocol}//${host}`;
        return { depName, datasource, registryUrls: [baseUrl] };
      }

      return { depName, datasource };
    }
    return { depName: url, datasource: GitTagsDatasource.id };
  } catch {
    return null;
  }
}
