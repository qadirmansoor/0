from unittest.mock import MagicMock, patch

from src.rejection.arduino_controller import ArduinoRejectionController
from src.rejection.plc_controller import PLCRejectionController


def test_arduino_controller_sends_pulse_command():
    fake_serial = MagicMock()
    fake_serial.readline.return_value = b"OK\n"

    with patch("serial.Serial", return_value=fake_serial), patch("time.sleep"):
        controller = ArduinoRejectionController({"port": "/dev/ttyFAKE", "baudrate": 9600})
        controller.connect()
        controller.trigger_reject(pulse_ms=250)

    fake_serial.write.assert_called_once_with(b"R,250\n")


def test_plc_controller_writes_coil_on_then_off():
    fake_client = MagicMock()
    fake_client.connect.return_value = True
    ok_result = MagicMock(isError=lambda: False)
    fake_client.write_coil.return_value = ok_result

    with patch("pymodbus.client.ModbusTcpClient", return_value=fake_client), patch("time.sleep"):
        controller = PLCRejectionController(
            {"ip": "10.0.0.5", "port": 502, "unit_id": 1, "reject_coil_address": 3}
        )
        controller.connect()
        controller.trigger_reject(pulse_ms=200)

        import threading

        for t in threading.enumerate():
            if t is not threading.main_thread():
                t.join(timeout=1)

    calls = fake_client.write_coil.call_args_list
    assert calls[0].args == (3, True)
    assert calls[1].args == (3, False)
