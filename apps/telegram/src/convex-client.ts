import { ConvexHttpClient } from "convex/browser";
import { config } from "./config.js";

// Note: In production, these imports should reference the generated Convex API
// For now, we'll use string-based API calls
export const convex = new ConvexHttpClient(config.convexUrl);

type Id<T extends string> = string & { __tableName: T };

/**
 * Get collection by subdomain
 */
export async function getCollectionBySubdomain(subdomain: string) {
  console.log(`[Convex] Getting collection by subdomain: ${subdomain}`);
  const api = {
    collections: {
      getBySubdomain: "collections:getBySubdomain" as any,
    },
  };
  return await convex.query(api.collections.getBySubdomain, { subdomain });
}

/**
 * Create a new search request
 */
export async function createSearchRequest(collectionId: Id<"collections">, telegramChatId: string) {
  console.log(`[Convex] Creating search request for collection ${collectionId}, chat ${telegramChatId}`);
  const api = {
    searchRequests: {
      create: "searchRequests:create" as any,
    },
  };
  return await convex.mutation(api.searchRequests.create, {
    collectionId,
    telegramChatId,
  });
}

/**
 * Get search request by ID
 */
export async function getSearchRequest(searchRequestId: Id<"searchRequests">) {
  console.log(`[Convex] Getting search request: ${searchRequestId}`);
  const api = {
    searchRequests: {
      get: "searchRequests:get" as any,
    },
  };
  return await convex.query(api.searchRequests.get, { id: searchRequestId });
}

/**
 * Subscribe to search request updates using polling
 * Note: For true real-time updates, this would need WebSocket support
 */
export function watchSearchRequest(
  searchRequestId: Id<"searchRequests">,
  callback: (data: any) => void
) {
  console.log(`[Convex] Watching search request: ${searchRequestId}`);
  
  // Poll every 2 seconds for updates
  const intervalId = setInterval(async () => {
    try {
      const data = await getSearchRequest(searchRequestId);
      callback(data);
      
      // Stop polling if completed or errored
      if (data && (data.status === "complete" || data.status === "error")) {
        clearInterval(intervalId);
      }
    } catch (error) {
      console.error("[Convex] Error polling search request:", error);
      clearInterval(intervalId);
    }
  }, 2000);
  
  // Return unsubscribe function
  return () => clearInterval(intervalId);
}
