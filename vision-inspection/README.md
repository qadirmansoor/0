# Pharma Vision Inspection System

A modular machine-vision inspection system for a pharmaceutical packaging
line: capture a frame, inspect it, and either print traceability
information onto a good unit (HP TIJ) or schedule a downstream reject
actuator (Arduino / Raspberry Pi / PLC) to eject a bad one.

This is a standalone Python subproject living in its own directory
(`vision-inspection/`) alongside the unrelated Next.js ERP app at the
repo root — it has its own dependencies, config, and test suite, and
doesn't share code with the rest of the repo. All commands below are
run from inside this directory.

## Architecture

```
Camera (builtin | USB3 | IP) ──► BasicCVInspector ──► pass ──► HP TIJ printer (batch/mfg/exp/MRP)
                                        │
                                        └──► fail ──► RejectDelayQueue ──► Arduino | Raspberry Pi | PLC
                                                       (delay = distance / conveyor speed, or fixed)
```

Everything is built behind small interfaces (`CameraBase`,
`InspectorBase`, `RejectionControllerBase`) so a component can be swapped
without touching the pipeline — e.g. drop in an ONNX/ML-based inspector,
or add a new reject-actuator backend.

```
src/
  cameras/         builtin_camera.py, usb3_camera.py, ip_camera.py, factory.py
  printer/         hp_tij.py               (TCP job/status driver)
  rejection/       arduino_controller.py, raspberry_pi_controller.py,
                    plc_controller.py, delay_queue.py, factory.py
  inspection/      defect_detector.py, pipeline.py, models.py
  api/             server.py                (FastAPI monitoring/control)
  main.py          wires everything together from config/config.yaml
config/config.yaml  all tunables (camera, printer, rejection, inspection, api)
tests/              unit tests, hardware I/O mocked
```

## Camera options

Set `camera.type` in `config/config.yaml`:

- **`builtin`** — the machine's built-in/UVC webcam, via OpenCV `VideoCapture(index)`.
- **`usb3`** — two selectable drivers under `camera.usb3.driver`:
  - `opencv`: generic UVC-class USB3 camera through OpenCV.
  - `genicam`: USB3 Vision / GenICam industrial camera via the
    [Harvesters](https://github.com/genicam/harvesters) library and a
    vendor `.cti` GenTL producer (Basler, FLIR, Teledyne, etc.) — gives
    access to exposure/gain controls. Requires `pip install harvesters`.
- **`ip`** — RTSP/HTTP network camera via OpenCV's FFMPEG backend, with
  automatic reconnect on stream drop.

All three implement the same `CameraBase.read_frame()` interface, so the
inspection pipeline doesn't care which one is active.

## HP TIJ printer

`src/printer/hp_tij.py` is a TCP/IP driver for an HP TIJ (Thermal
InkJet) printhead controller. HP TIJ cartridges are normally embedded
behind a vendor coder/marking controller that exposes a TCP command
port (commonly port 9100) — the exact command grammar is vendor
specific, so the wire format is a configurable template
(`printer.hp_tij.field_template`) rather than a hardcoded protocol.
Point it at your controller's documented command set. It supports
`send_print_job(fields)`, `get_status()`, and `clear_alarms()`, with
automatic reconnect/retry.

## Rejection: Arduino / Raspberry Pi / PLC

`rejection.type` selects the actuator hardware:

- **`arduino`** — serial (`pyserial`) line protocol `R,<pulse_ms>\n` →
  `OK\n` ack. Pair with a matching sketch that drives a relay/solenoid
  pin for the requested duration.
- **`raspberrypi`** — GPIO pulse via `gpiozero` (default) or `RPi.GPIO`,
  driving a relay that fires the reject solenoid/air-blast/pusher.
- **`plc`** — Modbus TCP (`pymodbus`): writes a coil `True` then `False`
  after `pulse_ms` to energize/de-energize the reject output. Can
  optionally push the computed delay into a PLC holding register if the
  PLC owns the delay timing itself.

### Rejection delay

A unit is inspected at the camera but ejected further downstream, so
firing must be delayed to match travel time. `rejection.delay.mode`:

- `fixed_ms` — a constant, operator-set delay.
- `conveyor_speed` — computed as `camera_to_reject_mm / conveyor_speed_mm_s * 1000`,
  so the delay tracks conveyor speed changes.

`RejectDelayQueue` (`src/rejection/delay_queue.py`) is a FIFO delay line:
each failed inspection is enqueued with its fire deadline, and a
background worker thread triggers the actuator once that deadline
elapses — preserving conveyor order without blocking the main capture
loop.

## Inspection

`BasicCVInspector` (`src/inspection/defect_detector.py`) is a
transparent, tunable classic-CV baseline:

- focus/blur check (variance of Laplacian)
- contamination/foreign-particle blobs (adaptive threshold + contour area)
- optional reference-image comparison for gross misalignment/mismatch

Swap in an ML model behind the same `InspectorBase.inspect()` interface
for more nuanced defect classes without touching the pipeline.

## Monitoring/control API

If `api.enabled: true`, a FastAPI server runs alongside the pipeline:

- `GET /health` — liveness
- `GET /status` — inspected/passed/rejected counters, queue depth, camera/printer connection state
- `POST /start` / `POST /stop` — start/stop the pipeline
- `POST /reject/test` — manually fire the reject actuator (commissioning)

## Running

```bash
cd vision-inspection
pip install -r requirements.txt
# for USB3 GenICam cameras: pip install harvesters
# for Raspberry Pi GPIO:   pip install gpiozero   (or RPi.GPIO)

python -m src.main --config config/config.yaml
```

## Traceability

Every rejected frame is archived to `line.reject_image_dir` (default
`./rejects`) with a timestamped filename, so failed units can be
audited against the corresponding print/reject event — useful for GMP
record-keeping.

## Tests

```bash
cd vision-inspection
python -m pytest
```

Hardware I/O (serial, Modbus, sockets, camera backends) is mocked, so
the suite runs without any physical camera, printer, Arduino, or PLC
attached. Covers: reject delay-queue timing/ordering, camera factory
dispatch, Arduino/PLC command framing, HP TIJ job templating, and the
basic-CV defect detector.
