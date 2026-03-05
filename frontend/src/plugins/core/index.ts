import { scaffoldPlugins } from "../../modules/scaffold/plugins";
import { customersPlugin } from "../../modules/customers/plugin";
import { actionCenterPlugin } from "../../modules/action-center/plugin";
import type { ModulePlugin } from "../types";
import { adminPlugin } from "./admin.plugin";
import { commsOutboundPlugin } from "./comms-outbound.plugin";
import { devContractsPlugin } from "./dev-contracts.plugin";
import { dmsHomePlugin } from "./dms-home.plugin";
import { launcherPlugin } from "./launcher.plugin";
import { opsPlugin } from "./ops.plugin";
import { outboxPlugin } from "./outbox.plugin";
import { procurementPlugin } from "./procurement.plugin";
import { settingsPlugin } from "./settings.plugin";
import { tenantsPlugin } from "./tenants.plugin";

export const corePlugins: ModulePlugin[] = [
  launcherPlugin,
  actionCenterPlugin,
  adminPlugin,
  settingsPlugin,
  opsPlugin,
  outboxPlugin,
  commsOutboundPlugin,
  procurementPlugin,
  tenantsPlugin,
  dmsHomePlugin,
  customersPlugin,
  ...scaffoldPlugins,
  devContractsPlugin,
];
