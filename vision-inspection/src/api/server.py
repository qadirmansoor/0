import time
from pathlib import Path
from typing import Any, Dict, Generator

from fastapi import FastAPI
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from ..inspection.pipeline import InspectionPipeline

STATIC_DIR = Path(__file__).parent / "static"
STREAM_FPS = 10


def create_api(pipeline: InspectionPipeline) -> FastAPI:
    app = FastAPI(title="Pharma Vision Inspection API")

    @app.get("/health")
    def health() -> Dict[str, Any]:
        return {"status": "ok"}

    @app.get("/status")
    def status() -> Dict[str, Any]:
        return pipeline.stats()

    @app.post("/start")
    def start() -> JSONResponse:
        try:
            pipeline.start()
        except Exception as exc:
            return JSONResponse(status_code=503, content={"running": False, "error": str(exc)})
        return JSONResponse(content={"running": True})

    @app.post("/stop")
    def stop() -> JSONResponse:
        try:
            pipeline.stop()
        except Exception as exc:
            return JSONResponse(status_code=500, content={"running": False, "error": str(exc)})
        return JSONResponse(content={"running": False})

    @app.post("/reject/test")
    def test_reject() -> Dict[str, Any]:
        pipeline.trigger_test_reject()
        return {"scheduled": True}

    @app.get("/rejects/recent")
    def recent_rejects(limit: int = 20) -> Dict[str, Any]:
        entries = pipeline.list_recent_rejects(limit=limit)
        for entry in entries:
            entry["image_url"] = f"/rejects/images/{entry['filename']}"
        return {"rejects": entries}

    @app.get("/stream")
    def stream() -> StreamingResponse:
        return StreamingResponse(
            _mjpeg_frames(pipeline),
            media_type="multipart/x-mixed-replace; boundary=frame",
        )

    pipeline.reject_image_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/rejects/images", StaticFiles(directory=str(pipeline.reject_image_dir)), name="reject-images")

    # Dashboard static assets/HTML, mounted last so it doesn't shadow the API routes above.
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="dashboard")

    return app


def _mjpeg_frames(pipeline: InspectionPipeline) -> Generator[bytes, None, None]:
    interval_s = 1.0 / STREAM_FPS
    boundary = b"--frame\r\n"
    while True:
        jpeg = pipeline.get_latest_jpeg()
        if jpeg is not None:
            yield (
                boundary
                + b"Content-Type: image/jpeg\r\n"
                + f"Content-Length: {len(jpeg)}\r\n\r\n".encode()
                + jpeg
                + b"\r\n"
            )
        time.sleep(interval_s)
