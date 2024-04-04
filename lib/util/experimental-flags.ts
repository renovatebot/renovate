import { GlobalConfig } from '../config/global';

const parsedExperimentalFlags: Record<string, any> = {};

export function experimentalFlagValue(flagName: string): string | null {
  const experimentalFlags = GlobalConfig.get('experimentalFlags');

  // Check if the flag value is already parsed and stored
  if (parsedExperimentalFlags[flagName]) {
    return parsedExperimentalFlags[flagName];
  }

  if (!experimentalFlags) {
    return null;
  }

  for (const flag of experimentalFlags) {
    if (flag.includes(flagName)) {
      const [key, value] = flag.split('=');
      parsedExperimentalFlags[key] = value;
      return value ? value : key;
    }
  }

  return null;
}
