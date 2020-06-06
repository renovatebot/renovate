import { RenovateConfig } from '../../config/common';

const initializations = [];

export function addInitializationCallback(callback: any): void {
  initializations.push(callback);
}

export async function initialize(config: RenovateConfig): Promise<void> {
  for (const callback of initializations) {
    await callback(config);
  }
}
