<script setup lang="ts">
import { SUPPORT_EMAIL } from "@/utils/landing";

useSeoMeta({
  title: "Refunds · FindPhotosOfMe",
  description: "Unused credit is refundable within 14 days of a top-up.",
});
</script>

<template>
  <LandingPolicy title="Refunds" updated="9 October 2026">
    <p>
      You pay for FindPhotosOfMe by topping up your balance in advance. If you don’t end up using it, you can have it back.
    </p>

    <h2>Unused credit, within 14 days</h2>
    <p>
      Within 14 days of a top-up, we refund whatever part of it you haven’t spent. Credit already used for uploaded photos,
      searches or storage isn’t refundable. The free credit new accounts start with is never paid out.
    </p>

    <h2>Charges we return automatically</h2>
    <p>
      If a search fails or finds no face in the selfie, or an uploaded photo is turned away because it has no face, couldn’t be
      processed, or didn’t pass the check on guest photos, its cost goes back to your balance without you asking.
    </p>

    <h2>How to ask</h2>
    <p>
      Write to <a :href="`mailto:${SUPPORT_EMAIL}`">{{ SUPPORT_EMAIL }}</a> from the email address on your account, with the
      order number from your receipt. The refund goes back to the card or account you paid with, through our payment provider,
      usually within 5–10 business days. The refunded amount is taken off your balance.
    </p>

    <h2>Something went wrong?</h2>
    <p>
      If the service didn’t work for your event, write to us even after 14 days. We’ll look at what happened and make it right.
    </p>
  </LandingPolicy>
</template>
