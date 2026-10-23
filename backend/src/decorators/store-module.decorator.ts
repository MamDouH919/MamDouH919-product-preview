import { SetMetadata } from "@nestjs/common";
import { StoreModule } from "../common/tenant/store-plan";

export const STORE_MODULES_KEY = "storeModules";

/** The route answers only on stores whose plan has every one of these modules. */
export const RequireModules = (...modules: StoreModule[]) =>
  SetMetadata(STORE_MODULES_KEY, modules);
