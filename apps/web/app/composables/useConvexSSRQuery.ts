import { useConvexQuery } from "convex-vue";

export const useConvexSSRQuery = async (query: any, args: any) => {
  const convexQuery = useConvexQuery(query, args);

  const ssrData = await convexQuery.suspense();

  const reactiveData = computed(() => {
    return convexQuery.data.value ?? ssrData;
  });

  return { ...convexQuery, data: reactiveData } as typeof convexQuery;
};
