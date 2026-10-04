import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
import { useConvexClient } from "convex-vue";

// Keep the SSR result visible until the authenticated subscription delivers data.
export function useLiveQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query>,
  initial: Readonly<Ref<FunctionReturnType<Query> | undefined>>,
) {
  const client = useConvexClient();
  const authenticated = useState("convexAuthenticated", () => false);
  const live = shallowRef<FunctionReturnType<Query>>();
  const delivered = ref(false);
  const error = shallowRef<Error>();
  onMounted(() => {
    watch(authenticated, (ready, _, onCleanup) => {
      if (!ready) return;
      const unsubscribe = client.onUpdate(query, args, (value) => {
        live.value = value;
        error.value = undefined;
        delivered.value = true;
      }, (cause) => {
        live.value = undefined;
        error.value = cause;
        delivered.value = true;
      });
      onCleanup(unsubscribe);
    }, { immediate: true });
  });
  return { data: computed(() => (delivered.value ? live.value : initial.value)), error };
}
