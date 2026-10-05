<script setup lang="ts">
import { authRedirect } from "#shared/utils/authRedirect";
import { Mail } from "@lucide/vue";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

useSeoMeta({ title: "Sign in · FindPhotosOfMe" });

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
  <div class="sign-in-page">
    <header class="sign-in-bar"><NuxtLink to="/" class="wordmark">FindPhotosOfMe</NuxtLink></header>
    <main class="sign-in-main">
      <Card class="sign-in-card">
        <CardHeader>
          <h1 class="sign-in-title">Sign in</h1>
          <CardDescription>Manage your galleries and help people find their photos.</CardDescription>
        </CardHeader>
        <CardContent>
          <div v-if="step === 'choose'" class="space-y-3">
            <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
            <Button size="lg" class="w-full" @click="signInWithGoogle">
              Sign in with Google
            </Button>
            <Button variant="outline" size="lg" class="w-full" @click="step = 'email'">
              <Mail class="size-5" />
              Sign in with email
            </Button>
          </div>

          <form v-else-if="step === 'email'" class="space-y-4" @submit.prevent="sendCode">
            <div class="space-y-2">
              <Label for="email">Email</Label>
              <Input id="email" v-model="email" type="email" autocomplete="email" required autofocus />
            </div>
            <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
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
            <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
            <div class="flex justify-end gap-2">
              <Button type="button" variant="ghost" @click="step = 'email'">Back</Button>
              <Button type="submit" :disabled="loading || code.length !== 6">
                {{ loading ? "Checking…" : "Sign in" }}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <NuxtLink class="back-home" to="/">Back to the website</NuxtLink>
    </main>
  </div>
</template>

<style scoped>
.sign-in-page { min-height: 100svh; background: var(--muted); }
.sign-in-bar { display: flex; align-items: center; height: 72px; padding-inline: clamp(20px, 4vw, 56px); background: var(--brand); color: var(--brand-foreground); }
.wordmark { font-size: 1.15rem; font-weight: 900; font-stretch: 118%; letter-spacing: -.02em; }
.sign-in-main { display: grid; justify-items: center; align-content: center; gap: 24px; min-height: calc(100svh - 72px); padding: 40px 20px; }
.sign-in-card { width: 100%; max-width: 480px; padding-block: clamp(28px, 4vw, 40px); gap: 28px; }
.sign-in-card :deep([data-slot="card-header"]), .sign-in-card :deep([data-slot="card-content"]) { padding-inline: clamp(24px, 4vw, 36px); }
.sign-in-title { font-size: clamp(2.4rem, 5vw, 3rem); }
.back-home { color: var(--muted-foreground); font-size: .9rem; text-decoration: underline; text-underline-offset: 4px; }
</style>
