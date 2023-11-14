import { coerceArray } from '../../../util/array';
import { newlineRegex, regEx } from '../../../util/regex';
import type { PuppetfileModule } from './types';

const forgeRegex = regEx(/^forge\s+['"]([^'"]+)['"]/);
const commentRegex = regEx(/#.*$/);

/**
 * For us a Puppetfile is build up of forges that have Modules.
 *
 * Modules are the updatable parts.
 *
 */
export class Puppetfile {
  private readonly forgeModules = new Map<string | null, PuppetfileModule[]>();

  public add(currentForge: string | null, module: PuppetfileModule): void {
    if (Object.keys(module).length === 0) {
      return;
    }

    if (!this.forgeModules.has(currentForge)) {
      this.forgeModules.set(currentForge, []);
    }

    this.forgeModules.get(currentForge)?.push(module);
  }

  public getForges(): (string | null)[] {
    return Array.from(this.forgeModules.keys());
  }

  public getModulesOfForge(
    forgeUrl: string | null | undefined,
  ): PuppetfileModule[] {
    const modules = this.forgeModules.get(forgeUrl ?? null);

    return coerceArray(modules);
  }
}

export function parsePuppetfile(content: string): Puppetfile {
  const puppetfile: Puppetfile = new Puppetfile();

  let currentForge: string | null = null;
  let currentPuppetfileModule: PuppetfileModule = {};

  for (const rawLine of content.split(newlineRegex)) {
    // remove comments
    const line = rawLine.replace(commentRegex, '');

    const forgeResult = forgeRegex.exec(line);
    if (forgeResult) {
      puppetfile.add(currentForge, currentPuppetfileModule);

      currentPuppetfileModule = {};

      currentForge = forgeResult[1];
      continue;
    }

    const moduleStart = line.startsWith('mod');

    if (moduleStart) {
      puppetfile.add(currentForge, currentPuppetfileModule);
      currentPuppetfileModule = {};
    }

    const moduleValueRegex = regEx(/(?:\s*:(\w+)\s+=>\s+)?['"]([^'"]+)['"]/g);
    let moduleValue: RegExpExecArray | null;

    while ((moduleValue = moduleValueRegex.exec(line)) !== null) {
      const key = moduleValue[1];
      const value = moduleValue[2];

      if (key) {
        currentPuppetfileModule.tags =
          currentPuppetfileModule.tags ?? new Map();
        currentPuppetfileModule.tags.set(key, value);
      } else {
        fillPuppetfileModule(currentPuppetfileModule, value);
      }
    }
  }

  puppetfile.add(currentForge, currentPuppetfileModule);

  return puppetfile;
}

function fillPuppetfileModule(
  currentPuppetfileModule: PuppetfileModule,
  value: string,
): void {
  // "positional" module values
  if (currentPuppetfileModule.name === undefined) {
    // moduleName
    currentPuppetfileModule.name = value;
  } else if (currentPuppetfileModule.version === undefined) {
    // second value without a key is the version
    currentPuppetfileModule.version = value;
  } else {
    // 3+ value without a key is not supported
    currentPuppetfileModule.skipReason = 'invalid-config';
  }
}
