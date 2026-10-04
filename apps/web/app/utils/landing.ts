// Pricing copy describes the calculator preview in docs/portfolio-launch.md.

export type Faq = { q: string; a: string };
export type FaqColumn = { title: string; items: Faq[] };

const WHO_CAN_SEE = "can open its page, see the preview photos you chose, and search with a selfie. Search matches the face in the submitted photo; it doesn’t check who that person is.";

export const FAQ = {
  upload: { q: "What do I upload, and how many photos can I add?", a: "ZIP files with JPEG or PNG photos. Each ZIP can be up to 2 GB with up to 10,000 files, and you can add more ZIPs later. The free trial includes up to 500 photos and 2 GB in total. For more, use the calculator to estimate a custom purchase, starting at $10. The calculator currently covers up to 20,000 photos." },
  searches: { q: "What counts as a search?", a: "Each selfie someone checks against your photos is one search. The calculator prices searches at $1.50 per 100. The people searching never pay; the person uploading the photos covers the cost." },
  processing: { q: "How long does processing take?", a: "It depends on how many photos you upload. Each ZIP shows its progress, and searching works as soon as it says Ready." },
  online: { q: "How long does my event stay online?", a: "The free trial lasts 7 days. For a paid collection, choose 30 or 90 days in the calculator. The first 30 days of storage are included; additional storage is $0.10 per GB per 30 days. These are preview terms for the upcoming custom checkout." },
  whoCanSee: { q: "Who can see the photos?", a: `Anyone with the event link ${WHO_CAN_SEE}` },
  bot: { q: "How do I set up the Telegram bot?", a: "Create a bot with @BotFather in Telegram, copy its token, and paste it into your event settings. Then share the bot link along with your event link." },
  selfie: { q: "What kind of selfie should I use?", a: "A clear, well-lit photo of one face, looking at the camera. If there are several faces in the photo, the search uses only one of them. JPEG, PNG, or WebP, up to 10 MB." },
  groups: { q: "Does it find people in group photos?", a: "Yes, search can find you in group shots too. Small or blurry faces, side views, and sunglasses can make matching harder." },
  misses: { q: "Can it miss photos or show someone else?", a: "Yes. Search can miss a photo or include someone who looks similar. A clear, well-lit selfie helps. Try another photo if you’re not finding the shots you expected." },
  account: { q: "Do I need an account to search?", a: "No. Open the event link and add a selfie. If the event has a photo bot, you can send your selfie there instead." },
  notOrganizer: { q: "I’m not the organizer. Can I still upload the photos?", a: "Yes, if you have permission to upload and share them. Create an event and share the link with the other attendees." },
} satisfies Record<string, Faq>;

/** The same answer under a different question, e.g. "How long does a gallery stay online?" */
export const ask = (faq: Faq, q: string): Faq => ({ q, a: faq.a });
export const whoCanSee = (link: string): Faq => ({ q: "Who can see the photos?", a: `Anyone with the ${link} ${WHO_CAN_SEE}` });
