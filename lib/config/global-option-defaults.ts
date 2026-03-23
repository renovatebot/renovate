import { clone } from '../util/clone.ts';

// Registry of option default values, keyed by option name.
// Populated by options/index.ts at module load time.
// Intentionally has no imports from options or global to avoid circular dependencies.
const optionDefaults = new Map<string, unknown>();

/**
 * Register the default value for a global config option.
 * Called by options/index.ts for each option that has an explicit default.
 */
export function registerGlobalOptionDefault(
  name: string,
  defaultValue: unknown,
): void {
  optionDefaults.set(name, defaultValue);
}

/**
 * Returns a clone of the registered default value for a global config option,
 * or `undefined` if no default was registered for that key.
 */
export function getGlobalOptionDefault(key: string): unknown {
  if (!optionDefaults.has(key)) {
    return undefined;
  }
  return clone(optionDefaults.get(key));
}
