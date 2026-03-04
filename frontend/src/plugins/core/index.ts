import { scaffoldPlugins } from "../../modules/scaffold/plugins";
import type { ModulePlugin } from "../types";
import { adminPlugin } from "./admin.plugin";
import { devContractsPlugin } from "./dev-contracts.plugin";
import { dmsHomePlugin } from "./dms-home.plugin";
import { launcherPlugin } from "./launcher.plugin";
import { opsPlugin } from "./ops.plugin";
import { outboxPlugin } from "./outbox.plugin";
import { settingsPlugin } from "./settings.plugin";
import { tenantsPlugin } from "./tenants.plugin";

export const corePlugins: ModulePlugin[] = [
  launcherPlugin,
  adminPlugin,
  settingsPlugin,
  opsPlugin,
  outboxPlugin,
  tenantsPlugin,
  dmsHomePlugin,
  ...scaffoldPlugins,
  devContractsPlugin,
];
