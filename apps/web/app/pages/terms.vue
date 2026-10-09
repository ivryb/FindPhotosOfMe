<script setup lang="ts">
import { SUPPORT_EMAIL } from "@/utils/landing";
import { INCLUDED_DAYS, TRIAL_DAYS } from "@FindPhotosOfMe/backend/convex/pricing";
import { PRICE_TEXT } from "@/utils/pricing";

useSeoMeta({
  title: "Terms · FindPhotosOfMe",
  description: "The terms for creating and sharing event photo galleries on FindPhotosOfMe.",
});
</script>

<template>
  <LandingPolicy title="Terms" updated="9 October 2026">
    <p>
      These terms cover your use of FindPhotosOfMe, run by Ivan Rybnikov. By creating an account or using a gallery, you agree to them.
      Questions go to <a :href="`mailto:${SUPPORT_EMAIL}`">{{ SUPPORT_EMAIL }}</a>.
    </p>

    <h2>What FindPhotosOfMe is</h2>
    <p>
      An online service for event photo galleries. You upload the photos from an event, choose who can see the gallery, and
      share it. Guests can find the photos they’re in by sending a selfie to that gallery. Search only looks inside the gallery
      it was sent to, never anywhere else.
    </p>

    <h2>Your photos</h2>
    <ul>
      <li>You keep all rights to the photos you upload. You give us permission to store, process and show them only to run your galleries.</li>
      <li>Only upload photos you have the right to share, and let the people in them know, for example in your event’s photo notice.</li>
      <li>Remove any photo when someone in it asks you to. We may remove it ourselves if they ask us.</li>
      <li>You decide whether a gallery is private or published, and you can delete it at any time.</li>
    </ul>

    <h2>What you can’t do</h2>
    <ul>
      <li>Use selfie search to track, identify or follow someone who didn’t choose to search, or to build a collection of other people’s faces.</li>
      <li>Upload photos of people taken without their knowledge in private settings, sexual content, content involving minors in any harmful way, or anything illegal.</li>
      <li>Upload photos you collected from other websites or social networks to search for people.</li>
      <li>Try to get around a gallery’s privacy settings, overload the service, or access other people’s accounts.</li>
    </ul>
    <p>We may suspend galleries or accounts that break these rules, and we’ll tell you why.</p>

    <h2>Payment</h2>
    <p>
      Galleries are paid for from your account balance, which you top up in advance, from {{ PRICE_TEXT.minimum }}. Photos cost {{ PRICE_TEXT.photos }},
      searches {{ PRICE_TEXT.searches }}, and keeping photos online beyond the included time {{ PRICE_TEXT.storage }} for every 30 days, charged by the day.
      A gallery stays online for {{ INCLUDED_DAYS }} days without storage charges, or {{ TRIAL_DAYS }} days while you’re on the free trial.
      Guests never pay. Nothing renews automatically. Payments are processed by our payment provider, shown at checkout, as the merchant of record.
      See <NuxtLink to="/refunds">Refunds</NuxtLink> for when you can get your money back.
    </p>

    <h2>Availability</h2>
    <p>
      We work to keep galleries online and searchable, but we can’t promise the service will never be interrupted. Search can
      miss a photo or show someone who looks similar. Keep your own copies of your photos; FindPhotosOfMe is not a backup.
    </p>

    <h2>Liability</h2>
    <p>
      To the extent the law allows, we’re not liable for indirect losses, and our total liability is limited to what you paid us
      in the 12 months before the claim. Nothing here limits rights you have under consumer law.
    </p>

    <h2>Changes and ending</h2>
    <p>
      We may update these terms and will post the new date here; for important changes we’ll email you. You can stop using
      FindPhotosOfMe and ask us to delete your account at any time.
    </p>
  </LandingPolicy>
</template>
