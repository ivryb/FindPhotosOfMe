# Gallery publication

New galleries need only a name. They start private, with no page address, and owners can upload photos and search them in the Photos tab. Owner searches and their result downloads require the owner's identity, even after publication.

The Gallery page tab begins with “Publish this gallery.” Save a unique page address before switching publication on. Only published galleries show a share link and QR code. Unpublishing closes public gallery browsing, new attendee searches (including Telegram), and authorization of existing attendee search results. Previously issued photo links remain valid until their existing expiry; downloaded copies cannot be recalled.

Existing galleries with no `published` value retain their public access. Creation explicitly records `published: false`; no migration is needed. Dashboard routes accept the gallery ID so a private gallery needs no address; old dashboard links using addresses still work.

Deletion is in the separate Settings tab. Publication does not change billing or storage expiry.

Regression coverage: `packages/backend/tests/publication.test.ts` exercises ownership, publication, legacy access, and result authorization through Convex. Web HTTP tests verify identity forwarding and private photo listing. Local browser checks use `bun tests/serve.ts` from `apps/web`, with isolated fixtures.
