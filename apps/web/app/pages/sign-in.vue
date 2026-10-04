<script setup lang="ts">
import { authRedirect } from "#shared/utils/authRedirect";
import { Mail } from "@lucide/vue";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const authClient = useAuthClient();
const route = useRoute();

const step = ref<"choose" | "email" | "code">("choose");
const email = ref("");
const code = ref("");
const loading = ref(false);
const error = ref<string | null>(null);

const redirectTo = computed(() => authRedirect(route.query.redirect));

async function signInWithGoogle() {
  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set("redirect", redirectTo.value);
  const result = await authClient.signIn.social({
    provider: "google",
    callbackURL: callback.href,
  });
  if (result.error) error.value = result.error.message ?? "Could not sign in";
}

async function sendCode() {
  loading.value = true;
  error.value = null;

  try {
    const result = await authClient.emailOtp.sendVerificationOtp({
      email: email.value,
      type: "sign-in",
    });
    if (result.error) throw new Error(result.error.message);
    step.value = "code";
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Could not send the code";
  } finally {
    loading.value = false;
  }
}

async function verifyCode() {
  if (code.value.length !== 6) return;
  loading.value = true;
  error.value = null;

  try {
    const result = await authClient.signIn.emailOtp({
      email: email.value,
      otp: code.value,
    });
    if (result.error) throw new Error(result.error.message);
    await authClient.getSession();
    await navigateTo(redirectTo.value);
  } catch (cause) {
    code.value = "";
    error.value = cause instanceof Error ? cause.message : "Invalid code";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="container flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
    <Card class="w-full max-w-md">
      <CardHeader>
        <CardTitle class="text-2xl">Sign in</CardTitle>
        <CardDescription>Manage events and help people find their photos.</CardDescription>
      </CardHeader>
      <CardContent>
        <div v-if="step === 'choose'" class="space-y-3">
          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
          <Button variant="outline" class="w-full" @click="signInWithGoogle">
            Sign in with Google
          </Button>
          <Button variant="outline" class="w-full" @click="step = 'email'">
            <Mail class="mr-2 size-4" />
            Sign in with email
          </Button>
        </div>

        <form v-else-if="step === 'email'" class="space-y-4" @submit.prevent="sendCode">
          <div class="space-y-2">
            <Label for="email">Email</Label>
            <Input id="email" v-model="email" type="email" autocomplete="email" required autofocus />
          </div>
          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
          <div class="flex justify-end gap-2">
            <Button type="button" variant="ghost" @click="step = 'choose'">Back</Button>
            <Button type="submit" :disabled="loading">{{ loading ? "Sending…" : "Send code" }}</Button>
          </div>
        </form>

        <form v-else class="space-y-4" @submit.prevent="verifyCode">
          <p class="text-sm text-muted-foreground">Enter the 6-digit code sent to {{ email }}.</p>
          <div class="space-y-2">
            <Label for="code">Sign-in code</Label>
            <Input
              id="code"
              v-model="code"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              pattern="[0-9]{6}"
              required
              autofocus
            />
          </div>
          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
          <div class="flex justify-end gap-2">
            <Button type="button" variant="ghost" @click="step = 'email'">Back</Button>
            <Button type="submit" :disabled="loading || code.length !== 6">
              {{ loading ? "Checking…" : "Sign in" }}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
