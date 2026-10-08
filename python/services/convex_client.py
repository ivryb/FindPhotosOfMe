"""Service-authenticated Convex operations. Failed writes must fail the job."""

import os
from convex import ConvexClient


class ConvexService:
    def __init__(self):
        self.client = ConvexClient(os.environ["CONVEX_URL"])
        self.service_token = os.environ["SERVICE_TOKEN"]

    def get_collection(self, collection_id: str) -> dict | None:
        return self.client.query("collections:getForService", {
            "id": collection_id, "serviceToken": self.service_token,
        })

    def get_batch(self, batch_id: str) -> dict | None:
        """The batch's status and photos: where each was uploaded, and its key in the gallery."""
        return self.client.query("uploads:getBatchForService", {"id": batch_id, "serviceToken": self.service_token})

    def complete_batch(self, batch_id: str, saved: list[str], saved_bytes: int):
        """Reports the photos kept, by name; Convex refunds the rest."""
        self.client.mutation("uploads:completeBatchForService", {
            "id": batch_id, "saved": saved, "savedBytes": saved_bytes, "serviceToken": self.service_token,
        })

    def report_progress(self, batch_id: str, attempt: int, progress: int):
        """How many of the batch's photos this worker has gone through, shown on the upload while the batch runs."""
        self.client.mutation("uploads:reportProgressForService", {
            "id": batch_id, "attempt": attempt, "progress": progress, "serviceToken": self.service_token,
        })

    def fail_batch(self, batch_id: str, attempt: int):
        self.client.mutation("uploads:failBatchForService", {"id": batch_id, "attempt": attempt, "serviceToken": self.service_token})

    def claim_face_index(self, collection_id: str) -> bool:
        """Holds the gallery's merge lock for maintenance until faces_merged releases it. False while a merge runs."""
        return self.client.mutation("uploads:claimFaceIndexForService", {
            "collectionId": collection_id, "serviceToken": self.service_token,
        })

    def faces_merged(self, collection_id: str, batch_ids: list[str]):
        self.client.mutation("uploads:facesMergedForService", {
            "collectionId": collection_id, "batchIds": batch_ids, "serviceToken": self.service_token,
        })

    def set_stored_bytes(self, collection_id: str, stored_bytes: int):
        self.client.mutation("collections:setStoredBytesForService", {
            "id": collection_id, "storedBytes": stored_bytes, "serviceToken": self.service_token,
        })

    def get_search_request(self, search_request_id: str) -> dict | None:
        return self.client.query("searchRequests:getForService", {
            "id": search_request_id, "serviceToken": self.service_token,
        })

    def update_search_request(self, search_request_id: str, status: str, *,
                              images_found: list[str] | None = None,
                              total_images: int | None = None, processed_images: int | None = None,
                              error: str | None = None):
        args = {"id": search_request_id, "status": status, "serviceToken": self.service_token}
        if error is not None:
            args["error"] = error
        if images_found is not None:
            args["imagesFound"] = images_found
        if total_images is not None:
            args["totalImages"] = total_images
        if processed_images is not None:
            args["processedImages"] = processed_images
        self.client.mutation("searchRequests:updateForService", args)
