"""Screens guest photos with OpenAI's free moderation endpoint before they join a gallery. Needs OPENAI_API_KEY."""

import base64

from openai import OpenAI

from services.renditions import RENDITION_TYPE


class ModerationService:
    def __init__(self):
        # Retries ride out brief rate limits. A longer outage fails the batch, so Convex retries it later rather
        # than letting unscreened photos through.
        self.client = OpenAI(timeout=30, max_retries=3)

    def allows(self, thumbnail: bytes) -> bool:
        """Whether a photo may join the gallery, judged by its thumbnail: originals can exceed the 20 MB limit."""
        url = f"data:{RENDITION_TYPE};base64,{base64.b64encode(thumbnail).decode()}"
        result = self.client.moderations.create(
            model="omni-moderation-latest", input=[{"type": "image_url", "image_url": {"url": url}}],
        ).results[0]
        flags = result.categories
        # Events include contact sports and play fights, so plain violence stays; gore does not.
        return not (flags.sexual or flags.violence_graphic
                    or flags.self_harm or flags.self_harm_intent or flags.self_harm_instructions)
