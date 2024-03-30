import { GlobalConfig } from '../config/global';

export function experimentalFlagValue(flagName: string): string | null {
  const experimentalFlags = GlobalConfig.get('experimentalFlags');
  if (!experimentalFlags) {
    return null;
  }

  for (const flag of experimentalFlags) {
    if (flag.includes(flagName)) {
      const [key, value] = flag.split('=');
      return value ? value : key;
    }
  }

  return null;
}
