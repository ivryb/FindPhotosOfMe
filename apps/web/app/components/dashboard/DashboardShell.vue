<script setup lang="ts">
import { Plus } from "@lucide/vue";
import { coveredBy, formatMoney } from "@FindPhotosOfMe/backend/convex/pricing";
import { Button } from "@/components/ui/button";

// The frame of every dashboard page: the yellow bar, the sidebar with every gallery and the shared balance, and the page.
const { galleries, covers, credit, creating, toppingUp } = useDashboard();
const route = useRoute();
const current = computed(() => route.params.subdomain);
const toppedUp = computed(() => route.query.top_up === "success");

const authClient = useAuthClient();
const session = authClient.useSession();

async function signOut() {
  await authClient.signOut();
  window.location.assign("/");
}
</script>

<template>
  <div class="dashboard">
    <header class="bar">
      <NuxtLink class="logo" to="/admin">FindPhotosOfMe</NuxtLink>
      <div class="account">
        <!-- The session is read in the browser, so the name appears after the page loads -->
        <ClientOnly><span>{{ session.data?.user.name || session.data?.user.email }}</span></ClientOnly>
        <button type="button" @click="signOut">Sign out</button>
      </div>
    </header>

    <div class="shell">
      <aside>
        <Button class="new" @click="creating = true"><Plus />New gallery</Button>
        <h2 class="label">Galleries</h2>
        <nav aria-label="Galleries">
          <NuxtLink v-for="gallery in galleries" :key="gallery._id" :to="`/admin/galleries/${gallery.subdomain ?? gallery._id}`" :aria-current="(gallery.subdomain === current || gallery._id === current) ? 'page' : undefined">
            <img v-if="covers[gallery._id]" :src="covers[gallery._id]" alt="">
            <span v-else class="blank" />
            <span>
              <b>{{ gallery.title }}</b>
              <small :class="galleryStatus(gallery).tone">{{ gallery.imagesCount ? `${count.format(gallery.imagesCount)} photos, ` : "" }}{{ galleryStatus(gallery).label.toLowerCase() }}</small>
            </span>
          </NuxtLink>
        </nav>
        <section class="balance" aria-labelledby="balance-title">
          <h2 id="balance-title" class="label">Balance</h2>
          <p :class="['credit', { out: credit < 0 }]">{{ formatMoney(credit) }}</p>
          <p class="covers">About {{ count.format(coveredBy(credit, "photo")) }} photos or {{ count.format(coveredBy(credit, "search")) }} searches</p>
          <Button class="top-up" @click="toppingUp = true">Top up</Button>
          <small>Shared by all your galleries.</small>
        </section>
      </aside>

      <main>
        <p v-if="toppedUp" class="notice" role="status">Payment received. Your balance updates as soon as Lemon Squeezy confirms it, usually within a minute.</p>
        <slot />
      </main>
    </div>

    <DashboardNewGallery v-model:open="creating" />
    <DashboardTopUp v-model:open="toppingUp" :credit="credit" />
  </div>
</template>

<style scoped>
.dashboard { min-height: 100vh; background: var(--muted); }
.bar { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 24px; height: 64px; padding-inline: clamp(16px, 3vw, 40px); background: var(--brand); box-shadow: 0 1px 0 rgb(0 0 0 / .08); }
.logo { margin-right: auto; font-size: 1.1rem; font-weight: 900; font-stretch: 118%; letter-spacing: -0.02em; }
.account { display: flex; align-items: center; gap: 16px; font-size: .95rem; font-weight: 600; }
.account button { text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 4px; cursor: pointer; }
@media (max-width: 640px) { .account span { display: none; } }

.shell { display: grid; grid-template-columns: 300px minmax(0, 1fr); min-height: calc(100vh - 64px); }
aside { position: sticky; top: 64px; align-self: start; display: flex; flex-direction: column; height: calc(100vh - 64px); overflow-y: auto; padding: 20px 14px; background: var(--foreground); color: var(--background); }
aside :focus-visible { outline: 3px solid var(--brand); outline-offset: 2px; }
.new { width: 100%; margin-bottom: 18px; background: var(--brand); color: var(--foreground); }
.new:hover { background: #ffdc4d; }
.label { padding: 0 10px 8px; color: #8e8e89; font-size: .85rem; font-weight: 600; font-stretch: 100%; letter-spacing: 0; }
nav a { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 8px; }
nav a:hover { background: #222220; }
nav a[aria-current="page"] { background: #2a2a28; box-shadow: inset 3px 0 0 var(--brand); }
nav img, .blank { flex: none; width: 48px; aspect-ratio: 1; object-fit: cover; border-radius: 6px; }
.blank { border: 2px dashed #4a4a47; }
nav b { display: block; font-size: .95rem; line-height: 1.25; }
nav small { display: block; margin-top: 2px; color: #8e8e89; font-size: .82rem; }
nav small.busy { color: var(--brand); }
nav small.bad { color: #f0907f; }

.balance { margin-top: auto; padding: 18px; background: #222220; border-radius: 12px; }
.balance .label { padding: 0; margin-bottom: 4px; }
.credit { font-size: 1.9rem; font-weight: 800; font-stretch: 112%; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.credit.out { color: #f0907f; }
.covers { margin-top: 2px; color: #b3b3ad; font-size: .88rem; }
.top-up { width: 100%; margin-top: 14px; background: var(--brand); color: var(--foreground); }
.top-up:hover { background: #ffdc4d; }
.balance small { display: block; margin-top: 10px; color: #8e8e89; font-size: .82rem; }

main { width: 100%; max-width: 1080px; padding: clamp(24px, 4vw, 44px) clamp(20px, 4vw, 48px) 80px; }
.notice { margin-bottom: 20px; padding: 14px 18px; background: var(--accent); border: 2px solid var(--brand); border-radius: 10px; font-weight: 600; }

@media (max-width: 900px) {
  .shell { grid-template-columns: minmax(0, 1fr); }
  aside { position: static; flex-direction: row; align-items: center; gap: 8px; height: auto; overflow-x: auto; padding: 12px; }
  .new { width: auto; margin: 0; }
  .label, nav small, .balance small, .covers { display: none; }
  nav { display: flex; gap: 6px; }
  nav a { white-space: nowrap; }
  .balance { display: flex; align-items: center; gap: 12px; margin: 0; padding: 8px 8px 8px 14px; white-space: nowrap; }
  .credit { font-size: 1.1rem; }
  .top-up { width: auto; margin: 0; }
}
</style>
