# Deploying to a server/edge box

This app is meant to run on (or near) the line's own network, since it
talks to local hardware (camera, Arduino/RPi/PLC) and the plant's HP TIJ
controller. "Hosting" it means running it on a machine that has network/USB
access to that hardware — a cloud VM won't be able to see a USB camera or a
serial port. A common setup is a small on-prem server or an industrial PC
on the same LAN as the line equipment.

Once it's running, the dashboard is reachable at `http://<that-host>:8000`
from any browser on the network — no client install.

## Option A: Docker (recommended for a server/industrial PC)

```bash
cd vision-inspection
${EDITOR:-vi} config/config.yaml   # set camera/printer/rejection settings for this line first
docker compose up -d --build
```

- Edit `config/config.yaml` *before* starting — it's bind-mounted read-only
  into the container, so changes take effect on `docker compose restart`
  without rebuilding the image.
- Local hardware (a USB/builtin camera, an Arduino/serial reject
  controller, Raspberry Pi GPIO) needs explicit device passthrough —
  uncomment the relevant lines in `docker-compose.yml`'s `devices:` block.
  IP cameras, a Modbus TCP PLC, and the HP TIJ controller are reached over
  the network and need no extra config beyond the container having a route
  to them (the default bridge network is enough on most setups).
- Reject images persist to `./rejects` on the host via the volume mount.
- Logs: `docker compose logs -f`.
- Stop: `docker compose down`.

### Firewall

Open/allow inbound TCP port 8000 (or whatever `api.port` is set to) from
the network the operators/supervisors will view the dashboard from.

## Option B: systemd (bare metal — e.g. a dedicated Raspberry Pi)

Simpler than Docker when you need direct GPIO access (Raspberry Pi reject
controller) or don't want container overhead on constrained hardware.

```bash
sudo mkdir -p /opt/vision-inspection
sudo cp -r vision-inspection/* /opt/vision-inspection/
cd /opt/vision-inspection
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt   # add -r requirements-dev.txt too if you want to run the tests here
# GPIO/GenICam extras if this line uses them:
# .venv/bin/pip install gpiozero harvesters

sudo useradd -r -G video,dialout,gpio -s /usr/sbin/nologin vision  # skip groups that don't exist on this host
sudo chown -R vision:vision /opt/vision-inspection

sudo cp deploy/systemd/vision-inspection.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now vision-inspection
```

Check it came up:

```bash
systemctl status vision-inspection
journalctl -u vision-inspection -f
curl http://localhost:8000/health
```

## Either way: verify from a browser

Open `http://<server-ip>:8000` from a machine on the same network. You
should see the dashboard; camera/printer badges will show "disconnected"
until real hardware is wired up and configured in `config/config.yaml`
(camera type/URL/index, printer IP, reject actuator type/port) — see the
main [README](README.md) for what each option does.
