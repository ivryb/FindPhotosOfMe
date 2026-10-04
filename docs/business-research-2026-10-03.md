# FindPhotosOfMe: business potential and first-customer plan

Research date: 3 October 2026. Decision: whether Ivan should develop this into a profitable side business, with the option to grow a substantial bootstrapped business. This is desk research and a proposed validation plan, not a revenue forecast or a launch-readiness audit.

## Recommendation

**Run a bounded commercial validation effort. There is enough evidence to justify trying to sell this, but not enough to justify a large product build or advertising budget.** Start with Eventmate introductions and Ivan’s existing IT Arena afterparty network. Aim to establish repeat purchases from organizers or photographers who already produce substantial photo collections and can reliably reach attendees.

The category is established. The uncertain part is whether FindPhotosOfMe can acquire and serve buyers profitably. Face search, browser access and per-event billing are already available elsewhere. The most promising initial advantage is trusted access to a particular event community, followed by a reliable, simple delivery experience.

A small profitable business is plausible. A larger bootstrapped business requires repeat event volume, low support effort and multiple sources of customers. Those are hypotheses to test, not facts established by competitor websites.

## Starting point and evidence boundaries

I inspected the running [combined landing draft](http://127.0.0.1:4173/landing-v2/combined.html), its [creative brief](landing-page-brief.md), [product and billing notes](portfolio-launch.md), [Python runtime notes](../python/README.md), and [existing migration verification](modal-handoff.md).

The draft offers organizer/photographer uploads, attendee selfie search and downloads, browser sign-in, optional event-specific Telegram search, and free attendee access. Draft plans are $49 for 5,000 photos/60 days and $149 for 20,000 photos/90 days; the free trial allows 250 photos/7 days. These are proposed commercial terms, not verified live checkout offers. The current browser product is a search destination with selected preview photos, not a full gallery replacement. Sample events, conversations and counts on the draft are illustrative.

Ivan confirmed that he knows the founder of [Eventmate](https://eventmate.live/) and previously gained visibility by creating this project for an IT Arena afterparty chat in Ukraine. This establishes a warm route to conversations. It does not establish an official IT Arena partnership, current adoption, permission to reuse old photos, or willingness to pay.

Public prices establish advertised offers. Organizer-owned pages establish actual deployments. Vendor case studies and forum posts help identify possible benefits and objections but do not measure their prevalence. No competitor profit, FindPhotosOfMe acquisition cost, retention, production margin, or search keyword volume was verified. Competitor functionality was not tested by uploading faces or purchasing plans.

## Demand exists, but the buyer needs a reason to pay

[The Meetings Show’s official 2025 gallery](https://www.themeetingsshow.com/2025-gallery) directs visitors to account creation and selfie search through Pica. [Energy Storage Summit USA’s official 2026 gallery](https://storageusa.solarenergyevents.com/2026-photo-gallery/) gives attendees a QR/link and selfie-based delivery instructions. It also explicitly warns that distant faces may not be recognized. These are stronger evidence of real adoption than a vendor’s list of logos, but they do not disclose commercial terms or usage rates.

The [competitor evidence file](competitor-research-2026-10-03.md) adds conference-owned Kwikpic deployments and a photographer’s own account of using SpotMyPhotos. This supports a real recurring job: distribute a large set of event photos to the people in them.

Attendee convenience and buyer value are different. The attendee wants good photos without scrolling. The organizer or photographer must believe the service improves delivery, reduces work, or increases the value of their existing event/photo budget. It is possible for attendees to love the experience while organizers still decline to pay.

| Pain or desired outcome | Evidence and confidence | What to validate locally |
| --- | --- | --- |
| Finding yourself in a large collection | Established workflow across actual conference deployments; inconvenience magnitude unmeasured | Observe people finding their photos in the previous gallery and in this product |
| Sorting, matching and answering individual requests | Named photographer testimonials describe this work; selected accounts, not a representative survey | Ask for the last event’s actual process, time spent and attendee requests |
| Getting useful photos while people still care | Existing operators offer rapid delivery; time-sensitive benefit is plausible | Time from photographer delivery to first attendee download; whether another upload delays publication |
| Event/sponsor visibility | Premagic sells branded delivery and engagement reporting; benefits are vendor-reported | Distinguish downloads, share-button clicks and confirmed public posts; none alone proves ticket-sales lift |
| Trust and consent | First-person discussions show both enthusiasm and discomfort | Whether consent explanations, sign-in and selfie upload prevent people completing the flow |
| Keeping the photographer’s workflow | Competitors bundle search into gallery tools or claim integrations | Whether ZIP creation and a second upload are tolerable at the tested price |

[Premagic’s Middle East Event Show case study](https://www.premagic.com/case-study/middle-east-event-show/) describes sponsor branding and gallery engagement. It suggests a higher-value outcome to investigate later, not an immediate reason to build a sponsor dashboard. [A photography discussion](https://www.reddit.com/r/photography/comments/1b50zn2/) includes enthusiasm about discovering event photos and concern that somebody else could search for them. Use this as qualitative interview input; forum commenters are not a random sample of buyers.

## Competition and substitutes

The full [competitor comparison](competitor-research-2026-10-03.md) records prices, limits, citations and uncertainties for eight direct/bundled products plus adjacent alternatives. The most decision-relevant examples are:

| Competitor | Advertised offer observed | Implication |
| --- | --- | --- |
| [SpotMyPhotos Go](https://www.spotmyphotos.com/spotmyphotos-go/) | $69/event, 1,500 photos; $29/additional 1,000; post-event sharing | A close established per-event alternative |
| [selfieseek](https://www.selfieseek.com/) | $39/event, 1,000 photos; no guest account | Low price and browser simplicity are already offered |
| [GuestCam](https://guestcam.co/pricing) | $49 Standard plus $45 MagicFind = $94/event | Search competes against broader photo-sharing bundles |
| [Pic-Time Advanced](https://www.pic-time.com/pricing/client-delivery-suite) | $42/month billed annually or $50 monthly; visitor selfie search included | A repeat photographer may already own the capability |

Our $49 draft has a higher advertised photo allowance than some entry plans, but this is not yet a verified advantage: throughput, file sizes, search load, retention and support differ. Competing mainly on the cheapest nominal photo count would make margin and reliability harder to protect.

The most important substitute may be the organizer’s existing shared folder or gallery. It has low incremental cost and already fits the delivery process. The interview question is “what makes you change how you delivered the last event?”, not just “is selfie search useful?”

Per-event pricing remains appropriate for an initial offer. Keep attendees free. Avoid introducing subscriptions, print sales, ticketing or a general photo platform during validation. Frequent photographers may eventually need a different commercial arrangement, but actual repeat usage should justify it.

## Best initial segment

**Start with repeat organizers of adult professional/community events and their photographers, reached through Eventmate and the IT Arena network.** Initial screening criteria, not market statistics: several hundred attendees, roughly 1,000–5,000 usable event photos, an identifiable budget owner, a person who can authorize uploading the collection, and an existing way to send a link to attendees.

Event frequency and access matter more than precise size thresholds. A smaller event with an engaged host and another event next month can be a better experiment than a flagship conference with a long buying cycle. Ask whether the customer already uses Pic-Time’s search or another equivalent before trying to replace it.

| Segment | Initial priority | Rationale |
| --- | --- | --- |
| Eventmate organizers and warm tech/community connections | First | Reachable buyers and a possible repeat distribution route |
| Event photographers serving these organizers | First/second | One relationship can bring several events; existing bundles are a challenge |
| Independent conference/event agencies | Second | Recurring volume, but demands and sales effort may be higher |
| One-off weddings and private celebrations | Later | Broader collection/guestbook competitors; less repeat purchasing by the host |
| Races | Later | Specialized expectations such as bib search and photo commerce; existing free bundled tools |
| Schools and children’s events | Outside initial experiment | Distinct buyer and consent requirements would expand scope |

[RunSignup’s RaceDay Photos](https://info.runsignup.com/webinars_events/raceday-photos-introduction/) advertises a free unlimited photo platform with automatic bib tagging. It illustrates why an apparently attractive adjacent segment can have a strong bundled substitute. It does not mean all sports organizers are unreachable.

## Eventmate: the best first partnership experiment

The confirmed [Eventmate site](https://eventmate.live/) advertises event setup, ticketing, attendee messages, check-in and repeat invitations. It names Marketing Coffee in Lviv as a community event series and reports 1,620+ hosted events and 170,000+ registrations. These are cumulative marketing claims, not a monthly addressable customer base. [Monobank’s own site](https://monobank.ua/en/events) independently describes its Eventmate partnership; its different cumulative counts should not be merged into a growth rate.

**Inference:** Eventmate is well placed to introduce the buyer and help the organizer distribute the photo link. This may reduce both acquisition effort and the risk of attendees never seeing the product. A partnership is not agreed, and its commercial potential depends on qualified event flow, not the total number of past registrations.

Propose a non-exclusive, manually run trial:

1. Ask the founder for introductions to five organizers with a near-term event, substantial photography and a recurring schedule. Marketing Coffee is an example to ask about, not a verified lead.
2. Agree who buys: normally the organizer or photographer. Eventmate could alternatively sponsor the pilot, but record that separately from end-customer willingness to pay.
3. Use the existing upload, checkout and event-link flow once ready. The organizer distributes the link through their existing attendee communication. No attendee-database transfer or custom integration is needed for this first test.
4. Track referrals and support time manually. Discuss a referral fee only if it leaves acceptable contribution after costs; any percentage in the scenarios below is an assumption, not an offer made to Eventmate.
5. Evaluate actual purchases and another event before building embedded search, shared authentication, white-label delivery or reseller billing.

The founder conversation should answer: how many relevant events happen each month; which clients already have this need; who has photo rights and upload responsibility; who owns attendee messaging; whether they prefer referrals or resale; what support they expect; and whether they intend to build similar functionality themselves.

Partner dependence is a business risk. Maintain a direct customer route and learn from the actual organizer, even when Eventmate supplies the introduction. If the partner chiefly wants bespoke development, price and assess that as a separate services decision.

## IT Arena: use the history to get evidence

The original afterparty project gives Ivan a credible founder story and a possible route back to people who have seen the idea. First establish what happened: who used it, what they found valuable, where they struggled, who supplied the photos and whether any organizer asked to use it again. Do not imply historical usage counts or an official endorsement without evidence and permission.

Ask known hosts, community admins or photographers for a small forthcoming event and an introduction to its budget owner. Do not make the experiment depend on the next annual flagship conference. [IT Arena’s own site](https://itarena.ua/) describes networking, afterparties and meetups; those connected communities are a prospecting context, not an available customer list.

Suggested conversation opener, not sent:

> I originally built FindPhotosOfMe for the IT Arena afterparty chat. I’m exploring whether organizers would pay to give attendees a simple link where they can find and download their photos with a selfie. How did you deliver photos at your last event, and could we try this at an upcoming one?

## Marketing channels, in order

| Channel | Concrete test | Success signal | Main limitation |
| --- | --- | --- | --- |
| Eventmate introductions | Five qualified organizer introductions; assisted setup for early events | Paid events, a repeat booking and acceptable support effort | Founder enthusiasm may not translate into buyer demand |
| Existing IT Arena/community contacts | Reconnect with former users and ask for organizer/photographer referrals | Introductions that become real event use and payment | Past visibility may be old or attendee-only |
| Photographer partnerships | Approach ten event photographers, beginning with warm referrals and previous event photo credits | One photographer brings a second paying event | Existing gallery subscriptions already include search |
| Narrow founder-led outreach | Select upcoming events with professional photography and a visible organizer; show a short, permissioned demo | Qualified conversations and paid pilots per hour of effort | At $49, lengthy individual selling is expensive |
| Useful buyer-intent content | A specific page about distributing conference photos, a real case study, then honest alternative comparisons | Organizer inquiries and paid events, not traffic alone | Search volume and acquisition economics are unmeasured |
| Attendee-to-organizer referrals | A restrained “Use this at your event” link after successful photo delivery | New organizer referrals attributed to completed events | Most attendees are not buyers; do not assume viral growth |

For cold prospect discovery, [MPI’s public photographer marketplace](https://mpiglobalmarketplace.com/Listing/Index/ConventionExhibitionMeeting_Services/Photographers/24872/187186//100/1) lists event specialists. [Sessionize](https://sessionize.com/) and [Luma’s event discovery](https://help.lu.ma/p/luma-ios-app) provide event/community context. These are places to identify fit; access does not authorize bulk messaging or use of private attendee lists.

Telegram is currently a delivery mechanism and could support a niche where event chats are already used. It does not itself acquire paying organizers. Broad consumer ads, generic “AI tool” directories and Product Hunt can generate attention without reaching the purchaser; prioritize them below direct learning. Paid search should wait until we know conversion and allowable acquisition cost. No media spend is proposed for the first test.

## Revenue potential: required volume, not a forecast

Use an illustrative mix of **70% $49 events and 30% $149 events**, giving **$79 average gross revenue per paid event**. The mix is a scenario assumption, not an observed sales distribution. Annualize a constant monthly rate only to show scale; actual event activity will be seasonal.

| Paid events/month | Annual gross event revenue | After a hypothetical 20% partner share, before every other cost |
| ---: | ---: | ---: |
| 20 | $18,960 | $15,168 |
| 100 | $94,800 | $75,840 |
| 300 | $284,400 | $227,520 |

Formula: monthly paid events × 12 × (0.7 × $49 + 0.3 × $149). The partner column multiplies that result by 0.8 and assumes all events are partner-sourced. Neither column is profit or contracted recurring revenue. Refunds, payment fees, taxes where applicable, infrastructure, model licensing, support, acquisition and founder compensation are excluded.

At this assumed mix, $100,000 annual gross requires 1,266 paid events/year, about 106/month; $250,000 requires 3,165/year, about 264/month. At 100 events/month, selling only $49 events yields $58,800/year; selling only $149 events yields $178,800. Price mix and event volume are the main revenue sensitivities. Actual willingness to pay is unmeasured.

Support can dominate the economics. In an explicitly hypothetical example, a $79 sale leaves $63.20 after a 20% referral share. One support hour valued at $50 leaves $13.20 before all other costs. Early assisted setup is useful research, but that level of effort cannot quietly become the permanent offer.

Measure contribution per event as cash collected minus refunds, payment fees, referral fees, attributable infrastructure/licensing and support labor. Keep shared fixed costs separate, then subtract them to assess business profit. The current project notes call for real ingestion/search/storage cost measurements and a model-license quote. Until those exist, the draft prices cannot establish profitability.

## A 30–45 day validation plan

The schedule starts when commercial rights and the basic customer flow are ready. Interviews and partner discussions can begin immediately. Payment and repeat demand are outcomes; clicks, searches and compliments are supporting evidence.

**Days 1–7: learn and qualify.** Hold about ten conversations across Eventmate organizers, the IT Arena network and photographers. Ask about the last event, not hypothetical enthusiasm: collection size, delivery timing, current gallery, attendee requests, repeat frequency, photo permissions, decision maker and budget. Show the existing demo; seek a concrete event date and a purchase decision at the proposed $49/$149 terms. Do not take payment before the paid flow and rights are ready.

**Days 8–30: run up to five real pilots.** Prefer at least three paying events, with at least two independent budget owners. A limited free case-study event can help, but keep free, partner-sponsored and organizer-paid events distinct. Get agreement on collection scope and link distribution before work begins. Avoid adding custom features unless a repeated obstacle makes the current test impossible.

**Days 30–45: make a decision.** Ask every buyer with another relevant event to purchase again. If their next event falls later, track a dated commitment separately from a completed repeat purchase. An annual organizer who has no next event during the test is not evidence of churn.

| Measure | Definition and use | Proposed decision criterion |
| --- | --- | --- |
| Paid demand | Completed, non-refunded paid events; count distinct budget owners and separate sponsorships | At least three paid pilots from at least two buyers justifies continuing discovery |
| Repeat demand | Second paid event among buyers with a subsequent eligible event; commitments reported separately | Seek two second purchases or dated commitments; actual purchases are stronger evidence |
| Contribution and effort | Contribution formula above plus hands-on minutes per event | Positive contribution after measured costs; support should move toward less than 30 minutes/event after initial learning |

These thresholds are small founder-set learning gates, not industry benchmarks or statistical proof of product-market fit. For diagnosis, record unique event-link visitors → sign-in → completed search → at least one download, using the same event and a seven-day window after sharing. Count people, not repeated attempts. Report downloaders/visitors separately from downloaders/all attendees; lack of a photo and failure to see the link can both reduce the latter. Do not interpret this funnel as face-recognition accuracy.

Check search quality with a small consented sample whose actual appearances can be reviewed; investigate incorrect matches separately from no results. Record event processing failures and privacy/access complaints. Real attendee failures take priority over hitting a revenue target.

Continue if people pay, some buy again and service effort falls. Reconsider the offer if buyers like it but choose their existing gallery, if no qualified buyer pays, or if partner/customer requirements turn each sale into custom work. If five events cannot be scheduled, report the untested state rather than presenting missing evidence as success or failure.

## What the landing page should learn from this

The current page explains attendee delight clearly, but the hero addresses three audiences and its main action does not immediately identify the buyer. For a commercial test, make organizer responsibility explicit near the headline and use an organizer-specific action such as “Try it with your event photos.”

Suggested positioning to test:

> Help attendees find their photos from your event.
>
> Upload your event photos and share one link. Attendees sign in, search with a selfie, and download their matches. You pay per event; attendees search for free.

Keep the visual demonstration. Replace illustrative proof with a permissioned real event case study when one exists. Show the upload-to-share workflow, measured processing expectations, actual retention/deletion rules and a clear support contact. Treat reduced admin work and increased sharing as hypotheses until measured. The story can mention the IT Arena afterparty origin accurately, without implying an official customer relationship.

The brief still references an older WhatsApp prototype, but the running page inspected here showed browser and Telegram delivery; I did not treat WhatsApp as a current promise. No copy or application changes were made for this research.

## Commercial prerequisites that affect the decision

**Model rights are a concrete dependency.** The local runtime uses InsightFace `buffalo_l`. The [upstream licensing statement](https://github.com/deepinsight/insightface#license) distinguishes MIT code from pretrained models restricted to non-commercial research and gives a commercial-licensing route for this model family. Establish documented rights and cost, or evaluate an appropriately licensed alternative, before commercial use. A free promotional pilot should not automatically be assumed to qualify as research.

**Face matching is not identity verification.** The local brief says stored results are account-restricted but the submitted face is not verified as belonging to that person. Do not promise that only the photographed person can search for their photos. Clarify consent, permitted uploads, retention, deletion and the handling of other people appearing in event collections. [UK ICO guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/biometric-data-guidance-biometric-recognition/how-do-we-process-biometric-data-lawfully/) explains the lawful-basis and special-category condition requirements for biometric recognition. That is jurisdiction-specific guidance, not a finding that this implementation complies with every target market’s law; choose the initial market and review the actual workflow accordingly.

**Reliability must be established at the promised scale.** Existing migration notes record tiny-fixture inference checks, not a full conference workload. Verify representative ingestion, simultaneous attendee searches, downloads, ownership and paid entitlements before inviting a paid event. The current document does not declare the product ready to launch.

The next useful business action is a founder conversation with Eventmate asking for five specific organizer introductions and a small paid trial. The next useful evidence is customers paying and returning, with known costs and support effort.
