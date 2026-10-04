<script setup lang="ts">
import { FAQ, ask, whoCanSee } from "@/utils/landing";

useSeoMeta({
  title: "FindPhotosOfMe for photographers: galleries guests can search with a selfie",
  description: "Deliver every shoot as a branded gallery. Guests find the photos they’re in with a selfie.",
});

const brand = { name: "Lumen Studio", color: "#1f5c4a" };
</script>

<template>
  <LandingPage>
    <LandingHero
      title="Galleries your clients’ guests can search"
      lede="Deliver every shoot as a gallery with your name on it. Guests add a selfie and find the photos they’re in, without scrolling through all of them."
      :ticks="['Your logo and colors', 'All your events in one account', 'Free for guests']"
    >
      <LandingEventPage
        url="lumenstudio.findphotosofme.com"
        label="A Lumen Studio gallery for Harbor Summit Lisbon, with preview photos and a button to find your photos."
        :brand="brand"
      />
    </LandingHero>
    <LandingHowItWorks
      intro="Upload a shoot once. Every guest finds their own photos with a selfie."
      :upload="{ title: 'Upload the shoot', text: 'Drop in your exported photos as ZIP files. We find the faces in every photo and show you when the gallery is ready.' }"
      :search="{ title: 'Guests search with a selfie', text: 'They open the gallery link and add a selfie. They see every photo they’re in and download the ones they want.' }"
    />
    <LandingEventsDashboard />
    <LandingBranding />
    <LandingPricing
      title="Free to try. One payment per gallery"
      text="Try a small gallery first, with no card needed. Then pay for the photos and searches you need, from $10. Guests always search for free."
      note="Guests never pay."
    />
    <LandingFaq
      :columns="[
        { title: 'Galleries', items: [
          { q: 'Can I put my logo and colors on the gallery?', a: 'Yes. Add your studio name, logo, and color once, and every gallery you publish uses them.' },
          { q: 'Can I keep several events in one account?', a: 'Yes. Every shoot gets its own gallery and link, all in one account.' },
          FAQ.upload, FAQ.searches, FAQ.processing, ask(FAQ.online, 'How long does a gallery stay online?'),
        ] },
        { title: 'Guests', items: [
          { q: 'Do guests need an account to search?', a: 'No. They open the gallery link and add a selfie.' },
          ask(FAQ.selfie, 'What kind of selfie should guests use?'), FAQ.groups, FAQ.misses, whoCanSee('gallery link'),
        ] },
      ]"
    />
    <LandingFinalCta title="Make your next gallery searchable" text="Upload a few photos from a recent shoot and try a selfie search." />
  </LandingPage>
</template>
