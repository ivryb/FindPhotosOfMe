<script setup lang="ts">
import { useSubdomain } from "@/composables/useSubdomain";
import { FAQ, ask, whoCanSee } from "@/utils/landing";
import { PRICE_TEXT } from "@/utils/pricing";

const subdomain = useSubdomain();
const route = useRoute();

// An event subdomain opens that event's search page instead of the landing page.
if (subdomain) {
  // Keep the subdomain in the query for local development
  if (import.meta.dev) {
    const query = route.query.subdomain ? `?subdomain=${route.query.subdomain}` : "";
    navigateTo(`/search${query}`);
  } else {
    navigateTo(`/search`);
  }
}

useSeoMeta({
  title: "FindPhotosOfMe: find yourself in event photos without endless scrolling",
  description: "Search thousands of event photos with a selfie. For attendees, event organizers, and photographers.",
});
</script>

<template>
  <LandingPage>
    <LandingHero
      title="Find yourself in event photos without endless scrolling"
      lede="Search thousands of event photos with a selfie. For attendees, event organizers, and photographers."
      :ticks="['No subscription', 'Free for attendees', 'No app to install']"
    >
      <LandingSearchDemo label="A photo of a face is added, every photo in the event is checked for that face, and only the 8 photos of that person remain." />
    </LandingHero>
    <LandingProblem />
    <LandingHowItWorks
      intro="Whoever has the photos uploads them once. Everyone in them can find their own with a selfie."
      :upload="{ title: 'Upload the photos', text: 'From a conference, a wedding, or a weekend trip. We find every face in every photo.' }"
      :search="{ title: 'Search with a selfie', text: 'Anyone with the link adds a selfie and sees the photos they’re in, group shots included.' }"
    />
    <LandingAudiences />
    <LandingGallery
      title="Publish a searchable gallery for your event"
      text="Your event gets its own page and link. Attendees add a selfie to find and download the photos they’re in."
    />
    <LandingPhotoBot
      title="A photo search bot for your event"
      text="Want to make it even easier? Add a Telegram or WhatsApp bot for your event. People send it a selfie and get their photos right in the chat."
    />
    <LandingPricing
      title="Free to try. One payment per event"
      :text="`Try it free first. When you need more, pay once for the photos and searches you use, from ${PRICE_TEXT.minimum}. Attendees always search for free.`"
      note="Attendees never pay."
    />
    <LandingFaq
      :columns="[
        { title: 'Uploading', items: [FAQ.upload, FAQ.searches, FAQ.processing, ask(FAQ.online, 'How long do my photos stay online?'), whoCanSee('event link')] },
        { title: 'Searching', items: [FAQ.selfie, FAQ.groups, FAQ.misses, FAQ.account] },
      ]"
    />
    <LandingFinalCta title="Try it on your own photos" :text="`Upload up to ${PRICE_TEXT.trialPhotos} photos, add a selfie, and see every photo you’re in.`" />
  </LandingPage>
</template>
