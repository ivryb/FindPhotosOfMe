import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
import { useConvexClient } from "convex-vue";

// Keep the SSR result visible until the authenticated subscription delivers data.
export function useLiveQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query>,
  initial: Ref<FunctionReturnType<Query> | undefined>,
) {
  const client = useConvexClient();
  const authenticated = useState("convexAuthenticated", () => false);
  const data = shallowRef(initial.value);
  const error = shallowRef<Error>();
  onMounted(() => {
    watch(authenticated, (ready, _, onCleanup) => {
      if (!ready) return;
      const unsubscribe = client.onUpdate(query, args, (value) => {
        data.value = value;
        error.value = undefined;
      }, (cause) => {
        data.value = undefined;
        error.value = cause;
      });
      onCleanup(unsubscribe);
    }, { immediate: true });
  });
  return { data, error };
}
