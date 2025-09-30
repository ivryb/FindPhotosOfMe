<script setup lang="ts">
import { ref } from 'vue'
import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import { useConvexMutation, useConvexQuery } from "convex-vue";

const { data, error, isPending } = useConvexQuery(api.todos.getAll, {});

const newTodoText = ref("");
const { mutate: createTodo, isPending: isCreatePending } = useConvexMutation(api.todos.create);

const { mutate: toggleTodo } = useConvexMutation(api.todos.toggle);
const { mutate: deleteTodo, error: deleteError } = useConvexMutation(
  api.todos.deleteTodo,
);

function handleAddTodo() {
  const text = newTodoText.value.trim();
  if (!text) return;

  createTodo({ text });
  newTodoText.value = "";
}

function handleToggleTodo(id: Id<"todos">, completed: boolean) {
  toggleTodo({ id, completed: !completed });
}

function handleDeleteTodo(id: Id<"todos">) {
  deleteTodo({ id });
}
</script>

<template>
  <div class="mx-auto w-full max-w-md py-10">
    <UCard>
      <template #header>
        <div>
          <div class="text-xl font-bold">Todo List</div>
          <div class="text-muted text-sm">Manage your tasks efficiently</div>
        </div>
      </template>
      <form @submit.prevent="handleAddTodo" class="mb-6 flex items-center gap-2">
        <UInput
          v-model="newTodoText"
          placeholder="Add a new task..."
          autocomplete="off"
          class="w-full"
          :disabled="isCreatePending"
        />
        <UButton
          type="submit"
          :disabled="isCreatePending || !newTodoText.trim()"
        >
            <span v-if="isCreatePending">
              <UIcon name="i-lucide-loader-2" class="animate-spin" />
            </span>
            <span v-else>Add</span>
        </UButton>
      </form>

        <p v-if="error || deleteError" class="mb-4 text-red-500">
          Error: {{ error?.message || deleteError?.message }}
        </p>
        <div v-if="isPending" class="flex justify-center py-4">
          <UIcon name="i-lucide-loader-2" class="animate-spin w-6 h-6" />
        </div>
        <p v-else-if="data?.length === 0" class="py-4 text-center">
          No todos yet. Add one above!
        </p>
        <ul v-else-if="data" class="space-y-2">
          <li
            v-for="todo in data"
            :key="todo._id"
            class="flex items-center justify-between rounded-md border p-2"
          >
            <div class="flex items-center gap-2">
              <UCheckbox
                :model-value="todo.completed"
                @update:model-value="() => handleToggleTodo(todo._id, todo.completed)"
                :id="`todo-${todo._id}`"
              />
              <label
                :for="`todo-${todo._id}`"
                :class="{ 'line-through text-muted': todo.completed }"
                class="cursor-pointer"
              >
                {{ todo.text }}
              </label>
            </div>
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              square
              @click="handleDeleteTodo(todo._id)"
              aria-label="Delete todo"
              icon="i-lucide-trash-2"
            />
          </li>
        </ul>
    </UCard>
  </div>
</template>
