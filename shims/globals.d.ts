export interface GameVaultPluginModuleMetadataV1 {
  name: string;
  author: string;
  version: string;
  description: string;
  keywords?: string[];
  license?: string;
  website?: string;
}

export interface GameVaultPluginModule {
  metadata: GameVaultPluginModuleMetadataV1;
}

export interface FindOptions {
  limit?: number;
  offset?: number;
  sort?: string;
  loadRelations?: boolean;
}

const globals = {
  RESERVED_PROVIDER_SLUGS: ["gamevault", "user"],
};
export default globals;
