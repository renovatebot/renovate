declare module 'global-agent' {
  export interface ProxyAgentConfigurationInputType {
    environmentVariableNamespace?: string;
    forceGlobalAgent?: boolean;
    socketConnectionTimeout?: number;
  }

  export interface ProxyAgentConfigurationType {
    readonly HTTP_PROXY: string;
    readonly HTTPS_PROXY: string;
    readonly NO_PROXY: string;
  }

  export function createGlobalProxyAgent(
    opts: ProxyAgentConfigurationInputType
  ): ProxyAgentConfigurationType;
}
