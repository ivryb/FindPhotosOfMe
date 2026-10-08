<script setup lang="ts">
import { FAQ, whoCanSee } from "@/utils/landing";
import { PRICE_TEXT } from "@/utils/pricing";

useSeoMeta({
  title: "FindPhotosOfMe for event organizers: let every attendee find their photos",
  description: "Upload your event photos and share one link. Attendees find the photos they’re in with a selfie.",
});
</script>

<template>
  <LandingPage>
    <LandingHero
      title="Let every attendee find their own photos"
      lede="Upload the photos from your conference or meetup and share one link. Attendees add a selfie and get the photos they’re in."
      :ticks="['Free for attendees', 'No app or sign-up', 'One payment per event']"
    >
      <LandingEventPage />
    </LandingHero>
    <LandingHowItWorks
      intro="You upload the photos once. Every attendee finds their own with a selfie."
      :upload="{ title: 'Upload the event photos', text: 'Drop in the ZIP files from your photographer. We find the faces in every photo and show you when the event is ready to search.' }"
      :search="{ title: 'Attendees search with a selfie', text: 'They open your event link and add a selfie. They see every photo they’re in, group shots included, and download the ones they want.' }"
    />
    <LandingShareScenes />
    <LandingPhotoBot
      title="A photo bot for your event"
      text="Want to make it even easier? Add a Telegram or WhatsApp bot for your event. Attendees send it a selfie and get their photos right in the chat."
    />
    <LandingPricing
      title="Free to try. One payment per event"
      :text="`Try it free first. When you need more, pay once for the photos and searches you use, from ${PRICE_TEXT.minimum}. Attendees always search for free.`"
      note="Attendees never pay."
    />
    <LandingFaq
      :columns="[
        { title: 'For organizers', items: [FAQ.upload, FAQ.searches, FAQ.processing, FAQ.online, whoCanSee('event link'), FAQ.bot] },
        { title: 'For attendees', items: [FAQ.selfie, FAQ.groups, FAQ.misses, FAQ.account, FAQ.notOrganizer] },
      ]"
    />
    <LandingFinalCta title="Try it on photos from your last event" :text="`Upload up to ${PRICE_TEXT.trialPhotos} photos and search for yourself with a selfie. Then share the link with your attendees.`" />
  </LandingPage>
</template>
