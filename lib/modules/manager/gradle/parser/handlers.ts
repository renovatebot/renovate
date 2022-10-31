import url from 'url';
import upath from 'upath';
import { logger } from '../../../../logger';
import { getSiblingFileName } from '../../../../util/fs';
import { regEx } from '../../../../util/regex';
import type { PackageDependency } from '../../types';
import { parseGradle } from '../parser';
import type { Ctx, GradleManagerData, VariableData } from '../types';
import { parseDependencyString } from '../utils';
import {
  ANNOYING_METHODS,
  GRADLE_PLUGINS,
  REGISTRY_URLS,
  interpolateString,
  loadFromTokenMap,
} from './common';

export function handleAssignment(ctx: Ctx): Ctx {
  const key = loadFromTokenMap(ctx, 'keyToken')[0].value;
  const valTokens = loadFromTokenMap(ctx, 'valToken');

  if (valTokens.length > 1) {
    // = template string with multiple variables
    ctx.tokenMap.templateStringTokens = valTokens;
    handleDepInterpolation(ctx);
    delete ctx.tokenMap.templateStringTokens;
  } else {
    // = string value
    const dep = parseDependencyString(valTokens[0].value);
    if (dep) {
      dep.groupName = key;
      dep.managerData = {
        fileReplacePosition: valTokens[0].offset + dep.depName!.length + 1,
        packageFile: ctx.packageFile,
      };
      ctx.deps.push(dep);
    }

    const varData: VariableData = {
      key,
      value: valTokens[0].value,
      fileReplacePosition: valTokens[0].offset,
      packageFile: ctx.packageFile,
    };
    ctx.globalVars = { ...ctx.globalVars, [key]: varData };
  }

  return ctx;
}

export function handleDepSimpleString(ctx: Ctx): Ctx {
  const stringToken = loadFromTokenMap(ctx, 'stringToken')[0];

  const dep = parseDependencyString(stringToken.value);
  if (dep) {
    dep.managerData = {
      fileReplacePosition: stringToken.offset + dep.depName!.length + 1,
      packageFile: ctx.packageFile,
    };
    ctx.deps.push(dep);
  }

  return ctx;
}

export function handleDepInterpolation(ctx: Ctx): Ctx {
  const stringTokens = loadFromTokenMap(ctx, 'templateStringTokens');

  const templateString = interpolateString(stringTokens, ctx.globalVars);
  if (!templateString) {
    return ctx;
  }

  const dep = parseDependencyString(templateString);
  if (!dep) {
    return ctx;
  }

  let packageFile: string | undefined;
  let fileReplacePosition: number | undefined;
  for (const token of stringTokens) {
    const varData = ctx.globalVars[token.value];
    if (token.type === 'symbol' && varData) {
      packageFile = varData.packageFile;
      fileReplacePosition = varData.fileReplacePosition;
      if (varData.value === dep.currentValue) {
        dep.managerData = { fileReplacePosition, packageFile };
        dep.groupName = varData.key;
      }
    }
  }

  if (!dep.managerData) {
    const lastToken = stringTokens[stringTokens.length - 1];
    if (
      lastToken?.type === 'string-value' &&
      dep.currentValue &&
      lastToken.value.startsWith(`:${dep.currentValue}`)
    ) {
      packageFile = ctx.packageFile;
      fileReplacePosition = lastToken.offset + 1;
      delete dep.groupName;
    } else {
      dep.skipReason = 'contains-variable';
    }
    dep.managerData = { fileReplacePosition, packageFile };
  }

  ctx.deps.push(dep);

  return ctx;
}

export function handleLongFormDep(ctx: Ctx): Ctx {
  const groupIdTokens = loadFromTokenMap(ctx, 'groupId');
  const artifactIdTokens = loadFromTokenMap(ctx, 'artifactId');
  const versionTokens = loadFromTokenMap(ctx, 'version');

  const groupId = interpolateString(groupIdTokens, ctx.globalVars);
  const artifactId = interpolateString(artifactIdTokens, ctx.globalVars);
  const version = interpolateString(versionTokens, ctx.globalVars);
  if (!groupId || !artifactId || !version) {
    return ctx;
  }

  const dep = parseDependencyString([groupId, artifactId, version].join(':'));
  if (!dep) {
    return ctx;
  }

  const methodName = ctx.tokenMap.methodName ?? null;
  if (versionTokens.length > 1) {
    // = template string with multiple variables
    dep.skipReason = 'unknown-version';
  } else if (versionTokens[0].type === 'symbol') {
    const varData = ctx.globalVars[versionTokens[0].value];
    if (varData) {
      dep.groupName = varData.key;
      dep.managerData = {
        fileReplacePosition: varData.fileReplacePosition,
        packageFile: varData.packageFile,
      };
    }
  } else {
    // = string value
    if (methodName && methodName[0]?.value === 'dependencySet') {
      dep.groupName = `${groupId}:${version}`;
    }
    dep.managerData = {
      fileReplacePosition: versionTokens[0].offset,
      packageFile: ctx.packageFile,
    };
  }

  if (methodName?.[0] && ANNOYING_METHODS.has(methodName[0].value)) {
    dep.skipReason = 'ignored';
  }

  ctx.deps.push(dep);

  return ctx;
}

export function handlePlugin(ctx: Ctx): Ctx {
  const methodName = loadFromTokenMap(ctx, 'methodName')[0];
  const pluginName = loadFromTokenMap(ctx, 'pluginName')[0];
  const pluginVersion = loadFromTokenMap(ctx, 'version');

  const plugin = pluginName.value;
  const depName =
    methodName.value === 'kotlin' ? `org.jetbrains.kotlin.${plugin}` : plugin;
  const packageName = `${depName}:${depName}.gradle.plugin`;

  const dep: PackageDependency<GradleManagerData> = {
    depType: 'plugin',
    depName,
    packageName,
    registryUrls: ['https://plugins.gradle.org/m2/'],
    commitMessageTopic: `plugin ${depName}`,
    currentValue: pluginVersion[0].value,
    managerData: {
      fileReplacePosition: pluginVersion[0].offset,
      packageFile: ctx.packageFile,
    },
  };

  if (pluginVersion.length > 1) {
    // = template string with multiple variables
    dep.skipReason = 'unknown-version';
  } else if (pluginVersion[0].type === 'symbol') {
    const varData = ctx.globalVars[pluginVersion[0].value];
    if (varData) {
      dep.currentValue = varData.value;
      dep.managerData = {
        fileReplacePosition: varData.fileReplacePosition,
        packageFile: varData.packageFile,
      };
    } else {
      dep.skipReason = 'unknown-version';
    }
  }

  ctx.deps.push(dep);

  return ctx;
}

export function handlePredefinedRegistryUrl(ctx: Ctx): Ctx {
  const registryName = loadFromTokenMap(ctx, 'registryUrl')[0].value;
  ctx.depRegistryUrls.push(
    REGISTRY_URLS[registryName as keyof typeof REGISTRY_URLS]
  );

  return ctx;
}

export function handleCustomRegistryUrl(ctx: Ctx): Ctx {
  let localVariables = ctx.globalVars;

  if (ctx.tokenMap.name) {
    const nameTokens = loadFromTokenMap(ctx, 'name');
    const nameValue = interpolateString(nameTokens, localVariables);
    if (nameValue) {
      localVariables = {
        ...localVariables,
        name: {
          key: 'name',
          value: nameValue,
        },
      };
    }
  }

  let registryUrl = interpolateString(
    loadFromTokenMap(ctx, 'registryUrl'),
    localVariables
  );
  if (registryUrl) {
    registryUrl = registryUrl.replace(regEx(/\\/g), '');
    try {
      const { host, protocol } = url.parse(registryUrl);
      if (host && protocol) {
        ctx.depRegistryUrls.push(registryUrl);
      }
    } catch (e) {
      // no-op
    }
  }

  return ctx;
}

export function handleLibraryDep(ctx: Ctx): Ctx {
  const groupIdTokens = loadFromTokenMap(ctx, 'groupId');
  const artifactIdTokens = loadFromTokenMap(ctx, 'artifactId');

  const groupId = interpolateString(groupIdTokens, ctx.globalVars);
  const artifactId = interpolateString(artifactIdTokens, ctx.globalVars);
  if (!groupId || !artifactId) {
    return ctx;
  }

  const aliasToken = loadFromTokenMap(ctx, 'alias')[0];
  const key = aliasToken.value.replace(regEx(/[-_]/g), '.');
  const varData: VariableData = {
    key,
    value: `${groupId}:${artifactId}`,
    fileReplacePosition: aliasToken.offset,
    packageFile: ctx.packageFile,
  };
  ctx.globalVars = { ...ctx.globalVars, [key]: varData };

  if (ctx.tokenMap.version) {
    const version = interpolateString(
      loadFromTokenMap(ctx, 'version'),
      ctx.globalVars
    );
    if (version) {
      handleLongFormDep(ctx);
    }
  }

  return ctx;
}

export function handleApplyFrom(ctx: Ctx): Ctx {
  let scriptFile = interpolateString(
    loadFromTokenMap(ctx, 'scriptFile'),
    ctx.globalVars
  );
  if (!scriptFile) {
    return ctx;
  }

  if (ctx.tokenMap.parentPath) {
    const parentPath = interpolateString(
      loadFromTokenMap(ctx, 'parentPath'),
      ctx.globalVars
    );
    if (parentPath && scriptFile) {
      scriptFile = upath.join(parentPath, scriptFile);
    }
  }

  if (ctx.recursionDepth > 2) {
    logger.debug(`Max recursion depth reached in script file: ${scriptFile}`);
    return ctx;
  }

  if (!regEx(/\.gradle(\.kts)?$/).test(scriptFile)) {
    logger.warn({ scriptFile }, `Only Gradle files can be included`);
    return ctx;
  }

  const scriptFilePath = getSiblingFileName(ctx.packageFile, scriptFile);
  if (!ctx.fileContents[scriptFilePath]) {
    logger.debug(`Failed to process included Gradle file ${scriptFilePath}`);
    return ctx;
  }

  const matchResult = parseGradle(
    // TODO #7154
    ctx.fileContents[scriptFilePath]!,
    ctx.globalVars,
    scriptFilePath,
    ctx.fileContents,
    ctx.recursionDepth + 1
  );

  ctx.deps.push(...matchResult.deps);
  ctx.globalVars = { ...ctx.globalVars, ...matchResult.vars };
  ctx.depRegistryUrls.push(...matchResult.urls);

  return ctx;
}

export function handleImplicitGradlePlugin(ctx: Ctx): Ctx {
  const pluginName = loadFromTokenMap(ctx, 'pluginName')[0].value;
  const versionTokens = loadFromTokenMap(ctx, 'version');
  const versionValue = interpolateString(versionTokens, ctx.globalVars);
  if (!versionValue) {
    return ctx;
  }

  const groupIdArtifactId =
    GRADLE_PLUGINS[pluginName as keyof typeof GRADLE_PLUGINS];
  const templateString = `${groupIdArtifactId}:${versionValue}`;

  const dep = parseDependencyString(templateString);
  if (!dep) {
    return ctx;
  }

  const version = versionTokens[0];
  dep.depType = 'devDependencies';
  dep.depName = pluginName;
  dep.packageName = groupIdArtifactId;
  dep.managerData = {
    fileReplacePosition: version.offset,
    packageFile: ctx.packageFile,
  };

  if (versionTokens.length > 1) {
    // = template string with multiple variables
    dep.skipReason = 'unknown-version';
  } else if (version.type === 'symbol') {
    const varData = ctx.globalVars[version.value];
    if (varData) {
      dep.currentValue = varData.value;
      dep.managerData = {
        fileReplacePosition: varData.fileReplacePosition,
        packageFile: varData.packageFile,
      };
    }
  }

  ctx.deps.push(dep);

  return ctx;
}
