export type ToolVersionsDep = {
  datasource: string; // Datasource supporting this dep
  depName?: string; // Actual package name within the datasource
  lookupName: string; // Git repo for currentDigest lookups
};
