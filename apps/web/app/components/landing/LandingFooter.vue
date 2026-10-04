<template>
  <footer>
    <div class="wrap">
      <NuxtLink class="logo" to="/">FindPhotosOfMe</NuxtLink>
      <span>Search photos by face.</span>
      <nav aria-label="Footer">
        <NuxtLink to="/organizers">Event organizers</NuxtLink>
        <NuxtLink to="/photographers">Photographers</NuxtLink>
        <NuxtLink to="/personal">Personal use</NuxtLink>
        <a href="#pricing">Pricing</a>
        <a href="#questions">Questions</a>
      </nav>
    </div>
  </footer>
</template>

<style scoped>
footer { padding-block: 36px; color: var(--muted-foreground); font-size: .92rem; }
.wrap { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 28px; }
.logo { color: var(--foreground); font-size: 1.15rem; font-weight: 900; font-stretch: 118%; letter-spacing: -0.02em; }
nav { display: flex; flex-wrap: wrap; gap: 20px; margin-left: auto; }
nav a:hover { text-decoration: underline; }
</style>
