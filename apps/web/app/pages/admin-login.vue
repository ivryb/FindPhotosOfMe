<script setup lang="ts">
import { ref } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

definePageMeta({
  middleware: [],
});

const password = ref("");
const error = ref<string | null>(null);
const isLoading = ref(false);

const adminAuth = useCookie("admin-auth");
const adminPassword = useCookie("admin-password");

async function handleSubmit() {
  error.value = null;
  isLoading.value = true;

  try {
    await $fetch("/api/admin-auth", {
      method: "POST",
      body: { password: password.value },
    });

    adminAuth.value = "true";
    adminPassword.value = password.value;
    navigateTo("/admin");
  } catch (e: any) {
    error.value = e.data?.message || "Invalid password";
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle class="text-2xl">Admin Login</CardTitle>
        <CardDescription>Enter the admin password to continue</CardDescription>
      </CardHeader>
      <CardContent>
        <form @submit.prevent="handleSubmit" class="grid gap-4">
          <div class="grid gap-2">
            <Label for="password">Password</Label>
            <Input
              id="password"
              v-model="password"
              type="password"
              placeholder="Enter password"
              required
              autofocus
            />
          </div>
          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
          <Button type="submit" class="w-full" :disabled="isLoading">
            {{ isLoading ? "Checking..." : "Login" }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
