import { GlobalConfig } from '../config/global';

export class ExperimentalFlag {
  private static parsedFlags: Record<string, string> = {};

  static get(key: string): string | null {
    const experimentalFlags = GlobalConfig.get('experimentalFlags');

    if (!experimentalFlags) {
      return null;
    }

    // Check if the flag value is already parsed and stored
    if (ExperimentalFlag.parsedFlags.hasOwnProperty(key)) {
      return ExperimentalFlag.parsedFlags[key];
    }

    for (const flag of experimentalFlags) {
      if (flag.includes(key)) {
        const [name, value] = flag.split('=');
        ExperimentalFlag.parsedFlags[name] = value ?? name;
        return value ?? name;
      }
    }

    return null;
  }

  static reset(): void {
    ExperimentalFlag.parsedFlags = {};
  }
}
