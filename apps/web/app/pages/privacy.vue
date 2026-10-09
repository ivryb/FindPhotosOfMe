<script setup lang="ts">
import { SUPPORT_EMAIL } from "@/utils/landing";

// Describes what the code does with photos, selfies and face data; update it whenever that changes.
useSeoMeta({
  title: "Privacy · FindPhotosOfMe",
  description: "What FindPhotosOfMe stores, how face matching works inside a gallery, and how to delete your photos.",
});
</script>

<template>
  <LandingPolicy title="Privacy" updated="9 October 2026">
    <p>
      FindPhotosOfMe lets people create photo galleries for their events and share them, like a shared folder.
      Guests can find the photos they’re in by sending a selfie to that one gallery. This page explains what we store,
      what face matching does and doesn’t do, and how to remove your data.
    </p>

    <h2>Who is responsible for what</h2>
    <p>
      FindPhotosOfMe is run by Ivan Rybnikov. Write to <a :href="`mailto:${SUPPORT_EMAIL}`">{{ SUPPORT_EMAIL }}</a> with any question or request.
    </p>
    <p>
      The person who creates a gallery decides which photos go into it and who can see it. They are responsible for having
      the right to upload those photos and for letting the people in them know. We store and process the photos on their behalf.
    </p>

    <h2>What face matching does</h2>
    <ul>
      <li>When photos are added to a gallery, we detect the faces in them and turn each face into a numeric description used for matching, along with an estimate of whether it looks male or female, which narrows the matches. Photos without a face are discarded, except in galleries where guests add photos.</li>
      <li>These face descriptions belong to that one gallery. A selfie is only ever compared with the photos of the gallery it was sent to. We never search across galleries, the wider internet, or social networks, and we don’t identify who anyone is by name.</li>
      <li>We don’t use your photos or faces to train models, and we don’t sell or share them for advertising.</li>
    </ul>

    <p>
      We process face data only because someone chose to: a guest who sends a selfie to search, and a gallery owner who
      adds photos to their own gallery.
    </p>

    <h2>Selfies</h2>
    <p>
      A selfie sent on the website or to a gallery’s Telegram bot is used once, to find matching photos, and is not saved.
      Its face description isn’t saved either. We keep the result of the search, meaning which photos matched, so the links
      to those photos keep working while the gallery is published. If you sent the selfie through Telegram, it also stays in your chat with the bot, under Telegram’s own terms.
    </p>

    <h2>What we store</h2>
    <ul>
      <li><b>Account:</b> your name, email address and, if you sign in with Google, your profile picture. For each sign-in session we keep the IP address and browser it came from, and we count sign-in attempts per IP address to stop abuse. You can sign in with Google or with a code sent to your email.</li>
      <li><b>Galleries:</b> the photos, smaller copies for faster viewing, the face descriptions, the gallery’s settings, and the results of searches made in it.</li>
      <li><b>Guest uploads:</b> when a gallery accepts photos from guests, we keep the photos and a random code in the guest’s browser that groups their uploads. We don’t ask guests for their name or email.</li>
      <li><b>Telegram:</b> for a gallery’s bot, the bot’s token and the chat it’s talking to.</li>
      <li><b>Payments:</b> the amounts and order numbers of your top-ups. Card details go straight to our payment provider; we never see them.</li>
    </ul>

    <h2>Who can see a gallery</h2>
    <p>
      New galleries are private. The owner chooses whether to publish one, through a secret link or a public page, and can
      unpublish it at any time. The owner can also hide browsing, so guests see only a few photos and the ones they’re in.
      After a gallery is unpublished, a browser that already opened a photo may keep showing it for up to ten minutes. A published gallery’s link preview, a small collage of its photos, can stay in browsers for up to a day, and chat apps keep their own copies of previews they’ve shown.
    </p>

    <h2>How long we keep data</h2>
    <ul>
      <li>A gallery’s photos, face descriptions and search results are kept until its owner deletes the gallery. Deleting a gallery removes all of them for good.</li>
      <li>When a gallery goes offline, because its paid time ended or the balance ran out, nobody can open it, but its photos stay stored so the owner can bring it back. Delete the gallery to remove them.</li>
      <li>Your account stays until you ask us to delete it. Write to us and we’ll delete your account and every gallery in it.</li>
    </ul>

    <h2>Services we use</h2>
    <p>We use these providers to run FindPhotosOfMe. Each one only handles what it needs for its part:</p>
    <ul>
      <li><b>Cloudflare</b> serves the website, stores the photos, and sends sign-in emails.</li>
      <li><b>Convex</b> stores accounts, gallery settings and search results.</li>
      <li><b>Modal</b> runs the face detection and matching.</li>
      <li><b>OpenAI</b> checks photos added by guests for sexual, graphic or self-harm content. It receives a small copy of each guest photo for that check only.</li>
      <li><b>Google</b> handles sign-in, if you choose to sign in with Google.</li>
      <li><b>Telegram</b> delivers messages for galleries that use a bot.</li>
      <li>Our <b>payment provider</b>, shown at checkout, processes payments as the merchant of record and receives your name and email for the receipt.</li>
    </ul>

    <h2>Cookies</h2>
    <p>
      We use only the cookies needed to keep you signed in. There are no advertising or analytics cookies.
    </p>

    <h2>Your rights</h2>
    <p>
      You can ask us for a copy of your data, to correct it, or to delete it. If you’re in a photo in someone’s gallery and
      want it removed, ask the gallery owner, or write to us and we’ll handle it. You can also complain to your local data
      protection authority.
    </p>
  </LandingPolicy>
</template>
