/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as authz from "../authz.js";
import type * as balances from "../balances.js";
import type * as collections from "../collections.js";
import type * as crons from "../crons.js";
import type * as healthCheck from "../healthCheck.js";
import type * as http from "../http.js";
import type * as migrations from "../migrations.js";
import type * as payments from "../payments.js";
import type * as photoKeys from "../photoKeys.js";
import type * as pricing from "../pricing.js";
import type * as searchRequests from "../searchRequests.js";
import type * as stagingStorage from "../stagingStorage.js";
import type * as telegram from "../telegram.js";
import type * as telegramAccess from "../telegramAccess.js";
import type * as todos from "../todos.js";
import type * as uploads from "../uploads.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authz: typeof authz;
  balances: typeof balances;
  collections: typeof collections;
  crons: typeof crons;
  healthCheck: typeof healthCheck;
  http: typeof http;
  migrations: typeof migrations;
  payments: typeof payments;
  photoKeys: typeof photoKeys;
  pricing: typeof pricing;
  searchRequests: typeof searchRequests;
  stagingStorage: typeof stagingStorage;
  telegram: typeof telegram;
  telegramAccess: typeof telegramAccess;
  todos: typeof todos;
  uploads: typeof uploads;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
