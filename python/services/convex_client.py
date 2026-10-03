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

    def get_ingest_job(self, job_id: str) -> dict | None:
        return self.client.query("ingestJobs:getForService", {
            "id": job_id, "serviceToken": self.service_token,
        })

    def update_collection_status(self, collection_id: str, status: str, images_count: int | None = None):
        args = {"id": collection_id, "status": status, "serviceToken": self.service_token}
        if images_count is not None:
            args["imagesCount"] = images_count
        self.client.mutation("collections:updateStatusForService", args)

    def set_collection_preview_images(self, collection_id: str, preview_images: list[str]):
        self.client.mutation("collections:setPreviewImagesForService", {
            "id": collection_id, "previewImages": preview_images[:50],
            "serviceToken": self.service_token,
        })

    def update_ingest_progress(self, job_id: str, *, total_images: int | None = None,
                               processed_images: int | None = None, status: str | None = None):
        args = {"id": job_id, "serviceToken": self.service_token}
        if total_images is not None:
            args["totalImages"] = total_images
        if processed_images is not None:
            args["processedImages"] = processed_images
        if status is not None:
            args["status"] = status
        self.client.mutation("ingestJobs:updateProgress", args)

    def mark_ingest_failed(self, job_id: str, error: str):
        self.client.mutation("ingestJobs:markFailed", {
            "id": job_id, "error": error, "serviceToken": self.service_token,
        })

    def mark_ingest_completed(self, job_id: str, processed_images: int):
        self.client.mutation("ingestJobs:markCompleted", {
            "id": job_id, "processedImages": processed_images, "serviceToken": self.service_token,
        })

    def get_search_request(self, search_request_id: str) -> dict | None:
        return self.client.query("searchRequests:getForService", {
            "id": search_request_id, "serviceToken": self.service_token,
        })

    def update_search_request(self, search_request_id: str, status: str, *,
                              images_found: list[str] | None = None,
                              total_images: int | None = None, processed_images: int | None = None):
        args = {"id": search_request_id, "status": status, "serviceToken": self.service_token}
        if images_found is not None:
            args["imagesFound"] = images_found
        if total_images is not None:
            args["totalImages"] = total_images
        if processed_images is not None:
            args["processedImages"] = processed_images
        self.client.mutation("searchRequests:updateForService", args)
