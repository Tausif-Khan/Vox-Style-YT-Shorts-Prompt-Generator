/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai_geminiSchemas from "../ai/geminiSchemas.js";
import type * as ai_index from "../ai/index.js";
import type * as ai_prompts from "../ai/prompts.js";
import type * as ai_provider from "../ai/provider.js";
import type * as editing from "../editing.js";
import type * as generation from "../generation.js";
import type * as ideas from "../ideas.js";
import type * as pipeline from "../pipeline.js";
import type * as projects from "../projects.js";
import type * as stages from "../stages.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "ai/geminiSchemas": typeof ai_geminiSchemas;
  "ai/index": typeof ai_index;
  "ai/prompts": typeof ai_prompts;
  "ai/provider": typeof ai_provider;
  editing: typeof editing;
  generation: typeof generation;
  ideas: typeof ideas;
  pipeline: typeof pipeline;
  projects: typeof projects;
  stages: typeof stages;
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

export declare const components: {};
