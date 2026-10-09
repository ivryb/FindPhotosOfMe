// Pricing copy describes the calculator preview in docs/portfolio-launch.md.
import { PRICE_TEXT } from "./pricing";

/** Where customers, guests and payment providers reach us; forwarded by Cloudflare Email Routing. */
export const SUPPORT_EMAIL = "support@findphotosofme.com";

export type Faq = { q: string; a: string };
export type FaqColumn = { title: string; items: Faq[] };

const WHO_CAN_SEE = "can open its page, browse the photos, and search with a selfie. You can turn browsing off so people see only a few photos and find the rest with a selfie. Search matches the face in the submitted photo; it doesn’t check who that person is.";

export const FAQ = {
  upload: { q: "What do I upload, and how many photos can I add?", a: `JPEG or PNG photos, as ZIP files of any size or one by one, up to 50 MB per photo. You can add more later. New accounts start with free credit for about ${PRICE_TEXT.trialPhotos} photos and ${PRICE_TEXT.trialSearches} searches. For more, top up your balance from ${PRICE_TEXT.minimum}; all your galleries share it. Use the calculator to estimate how much you need.` },
  searches: { q: "What counts as a search?", a: `Each selfie someone checks against your photos is one search. Searches cost ${PRICE_TEXT.searches}. The people searching never pay; the person uploading the photos covers the cost.` },
  processing: { q: "How long does processing take?", a: "Photos are processed while the rest are still uploading, many at a time, so it mostly depends on your connection. Each upload shows its progress, and photos can be found by search as soon as they’re processed." },
  moderation: { q: "Are the photos moderated?", a: "Yes. Every photo is checked automatically before it joins a gallery. Photos with sexual content, graphic violence or self-harm are turned away and not charged." },
  online: { q: "How long does my event stay online?", a: `During the free trial, a gallery stays online for 7 days. After your first top-up, the first 30 days are included, and you can pick any later date for it to go offline. Each day after that costs ${PRICE_TEXT.storage} of photos for every 30 days, taken from your balance a day at a time. If your balance runs out, the gallery goes offline until you top up.` },
  whoCanSee: { q: "Who can see the photos?", a: `Anyone with the event link ${WHO_CAN_SEE}` },
  bot: { q: "How do I set up the Telegram bot?", a: "Create a bot with @BotFather in Telegram, copy its token, and paste it into your gallery’s Telegram bot settings. Then share the bot link along with your event link." },
  selfie: { q: "What kind of selfie should I use?", a: "A clear, well-lit photo of one face, looking at the camera. If there are several faces in the photo, the search uses only one of them. JPEG, PNG, or WebP, up to 10 MB." },
  groups: { q: "Does it find people in group photos?", a: "Yes, search can find you in group shots too. Small or blurry faces, side views, and sunglasses can make matching harder." },
  misses: { q: "Can it miss photos or show someone else?", a: "Yes. Search can miss a photo or include someone who looks similar. A clear, well-lit selfie helps. Try another photo if you’re not finding the shots you expected." },
  account: { q: "Do I need an account to search?", a: "No. Open the event link and add a selfie. If the event has a photo bot, you can send your selfie there instead." },
  notOrganizer: { q: "I’m not the organizer. Can I still upload the photos?", a: "Yes, if you have permission to upload and share them. Create an event and share the link with the other attendees." },
} satisfies Record<string, Faq>;

/** The same answer under a different question, e.g. "How long does a gallery stay online?" */
export const ask = (faq: Faq, q: string): Faq => ({ q, a: faq.a });
export const whoCanSee = (link: string): Faq => ({ q: "Who can see the photos?", a: `Anyone with the ${link} ${WHO_CAN_SEE}` });
