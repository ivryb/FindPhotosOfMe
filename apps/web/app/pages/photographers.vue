<script setup lang="ts">
import { FAQ, ask, whoCanSee } from "@/utils/landing";

useSeoMeta({
  title: "FindPhotosOfMe for photographers: galleries your clients can search with a selfie",
  description: "Upload a shoot and send one link. Everyone in the photos finds the ones they’re in with a selfie.",
});
</script>

<template>
  <LandingPage>
    <LandingHero
      title="Galleries your clients can search with a selfie"
      lede="Upload a shoot and send your client one link. They and their guests add a selfie and find the photos they’re in, without scrolling through all of them."
      :ticks="['All your galleries in one account', 'Free for guests', 'No subscription']"
    >
      <LandingEventPage />
    </LandingHero>
    <LandingHowItWorks
      intro="Upload a shoot once. Every guest finds their own photos with a selfie."
      :upload="{ title: 'Upload the shoot', text: 'Drop in your exported photos as ZIP files. We find the faces in every photo and show you when the gallery is ready.' }"
      :search="{ title: 'Guests search with a selfie', text: 'They open the gallery link and add a selfie. They see every photo they’re in and download the ones they want.' }"
    />
    <LandingDashboard />
    <LandingPricing
      title="Free to try. One payment per gallery"
      text="Try it free first. When you need more, pay once for the photos and searches you use, from $10. Guests always search for free."
      note="Guests never pay."
    />
    <LandingFaq
      :columns="[
        { title: 'Galleries', items: [
          { q: 'Can I keep several galleries in one account?', a: 'Yes. Every shoot gets its own gallery and link, all in one account, and one balance pays for all of them.' },
          FAQ.upload, FAQ.searches, FAQ.processing, ask(FAQ.online, 'How long does a gallery stay online?'),
        ] },
        { title: 'Guests', items: [
          { q: 'Do guests need an account to search?', a: 'No. They open the gallery link and add a selfie.' },
          ask(FAQ.selfie, 'What kind of selfie should guests use?'), FAQ.groups, FAQ.misses, whoCanSee('gallery link'),
        ] },
      ]"
    />
    <LandingFinalCta title="Try it on your last shoot" text="Upload up to 500 photos and search them with a selfie, the same way your clients will." />
  </LandingPage>
</template>
