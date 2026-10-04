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
import type * as collections from "../collections.js";
import type * as healthCheck from "../healthCheck.js";
import type * as http from "../http.js";
import type * as ingest from "../ingest.js";
import type * as ingestJobs from "../ingestJobs.js";
import type * as payments from "../payments.js";
import type * as searchRequests from "../searchRequests.js";
import type * as telegram from "../telegram.js";
import type * as todos from "../todos.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authz: typeof authz;
  collections: typeof collections;
  healthCheck: typeof healthCheck;
  http: typeof http;
  ingest: typeof ingest;
  ingestJobs: typeof ingestJobs;
  payments: typeof payments;
  searchRequests: typeof searchRequests;
  telegram: typeof telegram;
  todos: typeof todos;
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
