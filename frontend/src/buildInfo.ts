import { APP_VERSION } from "./generated/version";

declare const __APP_COMMIT__: string;
declare const __APP_COMMIT_SHORT__: string;
declare const __APP_ENV__: string;

const commitFull = __APP_COMMIT__ || "";
const commitShort = __APP_COMMIT_SHORT__ || "dev";
const environment = __APP_ENV__ || "local";

const environmentSuffix =
  environment === "production" ? "" : ` (${environment})`;

export const APP_VERSION_FULL = APP_VERSION;
export const APP_COMMIT = commitShort;
export const APP_COMMIT_FULL = commitFull;
export const APP_ENV = environment;
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
export const APP_VERSION_TITLE =
  `CIVEN v${APP_VERSION} · ${commitShort}${environmentSuffix}`;
