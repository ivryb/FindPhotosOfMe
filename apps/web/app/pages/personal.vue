<script setup lang="ts">
import { FAQ, ask } from "@/utils/landing";

useSeoMeta({
  title: "FindPhotosOfMe for personal use: filter a pile of photos by face",
  description: "Add a folder of photos and a picture of someone’s face. Get back every photo they’re in.",
});
</script>

<template>
  <LandingPage>
    <LandingHero
      title="Filter a pile of photos by face"
      lede="Add a folder of photos and a picture of someone’s face. Get back every photo they’re in."
      :ticks="['500 photos free', 'No app to install', 'No subscription']"
    >
      <LandingSearchDemo
        label="A photo of a face is added, every photo in the pile is checked for it, and only the 8 photos with that face remain."
        pile="All photos"
        add-face="Add a face"
        face="Face"
        looking="Looking for this face"
        found="photos with this face"
      />
    </LandingHero>
    <LandingUses />
    <LandingHowItWorks
      intro="Upload the photos, then show it the face you’re looking for."
      :upload="{ name: 'All photos', title: 'Upload the photos', text: 'Drop in a ZIP of your photos. We find the faces in every photo and let you know when they’re ready.' }"
      :search="{ title: 'Add a face', text: 'A selfie, or a clear photo of the person you’re looking for. You get back every photo they’re in.' }"
    />
    <LandingPricing
      title="Free to try. One payment, no subscription"
      text="Try it free first. For a bigger pile, pay once for the photos and searches you use, from $10."
      note="People you share the link with never pay. Plans for whole photo libraries are in the works."
    />
    <LandingFaq
      :columns="[
        { title: 'Uploading', items: [
          FAQ.upload, FAQ.searches, FAQ.processing,
          { q: 'Who can see my photos?', a: 'Only people you share the link with. They can open the page, browse the photos, and search with a selfie. You can turn browsing off so they see only a few photos.' },
          ask(FAQ.online, 'How long do my photos stay online?'),
        ] },
        { title: 'Searching', items: [
          { q: 'Can I search for someone other than me?', a: 'Yes. Add a clear photo of their face, and you’ll get back the photos they’re in.' },
          { q: 'Can other people search too?', a: 'Yes. Share the link, and anyone you send it to can search with their own selfie.' },
          FAQ.groups, FAQ.misses,
        ] },
      ]"
    />
    <LandingFinalCta title="Try it on a folder of your photos" text="Upload up to 500 photos and add a photo of one face. You’ll get back every photo that person is in." />
  </LandingPage>
</template>
