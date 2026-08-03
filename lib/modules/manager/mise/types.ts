export interface MiseRegistryData {
  meta: {
    version: string;
  };
  tools: Record<string, Record<string, string>>;
}
