import argparse
import signal
import threading
import time

from .api.server import create_api
from .cameras.factory import create_camera
from .config import load_config
from .inspection.defect_detector import BasicCVInspector
from .inspection.pipeline import InspectionPipeline
from .printer.hp_tij import HPTIJPrinter
from .rejection.factory import create_rejection_system
from .utils.logger import get_logger

logger = get_logger(__name__)


def build_pipeline(config: dict):
    camera = create_camera(config["camera"])
    inspector = BasicCVInspector(config["inspection"])

    controller, reject_queue, reject_delay_ms = create_rejection_system(config["rejection"])
    controller.connect()

    printer = None
    print_cfg = config.get("printer", {})
    if print_cfg.get("type") == "hp_tij":
        printer = HPTIJPrinter(print_cfg.get("hp_tij", {}))

    line_cfg = config.get("line", {})
    pipeline = InspectionPipeline(
        camera=camera,
        inspector=inspector,
        reject_queue=reject_queue,
        reject_delay_ms=reject_delay_ms,
        printer=printer,
        save_reject_images=line_cfg.get("save_reject_images", True),
        reject_image_dir=line_cfg.get("reject_image_dir", "./rejects"),
        target_fps=line_cfg.get("camera_fps", 30),
        line_name=line_cfg.get("name", "Line-01"),
    )
    return pipeline, controller


def main() -> None:
    parser = argparse.ArgumentParser(description="Pharma vision inspection system")
    parser.add_argument("--config", default="config/config.yaml", help="Path to config YAML")
    args = parser.parse_args()

    config = load_config(args.config)
    pipeline, reject_controller = build_pipeline(config)
    pipeline.start()

    api_cfg = config.get("api", {})
    if api_cfg.get("enabled", True):
        import uvicorn

        app = create_api(pipeline)
        server_thread = threading.Thread(
            target=lambda: uvicorn.run(
                app, host=api_cfg.get("host", "0.0.0.0"), port=int(api_cfg.get("port", 8000)), log_level="warning"
            ),
            daemon=True,
        )
        server_thread.start()
        logger.info("Monitoring API listening on %s:%s", api_cfg.get("host", "0.0.0.0"), api_cfg.get("port", 8000))

    stop_event = threading.Event()

    def _handle_signal(signum, frame) -> None:
        logger.info("Received signal %s, shutting down", signum)
        stop_event.set()

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    stats_interval = config.get("line", {}).get("stats_log_interval_s", 60)
    last_stats_log = time.monotonic()
    while not stop_event.is_set():
        stop_event.wait(timeout=1)
        if time.monotonic() - last_stats_log >= stats_interval:
            logger.info("Stats: %s", pipeline.stats())
            last_stats_log = time.monotonic()

    pipeline.stop()
    reject_controller.disconnect()


if __name__ == "__main__":
    main()
