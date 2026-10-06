import { getFunctionName, type FunctionArgs, type FunctionReference, type FunctionReturnType } from "convex/server";
import { useConvexQuery } from "convex-vue";

/**
 * A live Convex query that the server renders with. Its result travels with the page, so the browser hydrates
 * at once instead of waiting for the websocket to answer the same query, and then follows live updates.
 */
export async function useConvexSSRQuery<Query extends FunctionReference<"query">>(query: Query, args: FunctionArgs<Query>) {
  const live = useConvexQuery(query, args);
  const rendered = useState<FunctionReturnType<Query> | undefined>(`convex:${getFunctionName(query)}:${JSON.stringify(args)}`);
  if (rendered.value === undefined) rendered.value = await live.suspense();
  return { ...live, data: computed(() => live.data.value === undefined ? rendered.value : live.data.value) };
}
