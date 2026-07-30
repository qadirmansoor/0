from typing import Any, Dict

from fastapi import FastAPI

from ..inspection.pipeline import InspectionPipeline


def create_api(pipeline: InspectionPipeline) -> FastAPI:
    app = FastAPI(title="Pharma Vision Inspection API")

    @app.get("/health")
    def health() -> Dict[str, Any]:
        return {"status": "ok"}

    @app.get("/status")
    def status() -> Dict[str, Any]:
        return pipeline.stats()

    @app.post("/start")
    def start() -> Dict[str, Any]:
        pipeline.start()
        return {"running": True}

    @app.post("/stop")
    def stop() -> Dict[str, Any]:
        pipeline.stop()
        return {"running": False}

    @app.post("/reject/test")
    def test_reject() -> Dict[str, Any]:
        pipeline.trigger_test_reject()
        return {"scheduled": True}

    return app
