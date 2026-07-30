from unittest.mock import MagicMock, patch

import pytest

from src.printer.hp_tij import HPTIJPrinter, PrinterError


def make_printer(**overrides):
    config = {
        "ip": "10.0.0.10",
        "port": 9100,
        "field_template": "^JOB^BATCH={batch}^EXP={exp_date}^END\n",
        "retries": 2,
    }
    config.update(overrides)
    return HPTIJPrinter(config)


def test_send_print_job_formats_and_sends_payload():
    fake_sock = MagicMock()
    with patch("socket.create_connection", return_value=fake_sock):
        printer = make_printer()
        printer.connect()
        printer.send_print_job({"batch": "B123", "exp_date": "2027-01"})

    fake_sock.sendall.assert_called_once_with(b"^JOB^BATCH=B123^EXP=2027-01^END\n")


def test_send_print_job_missing_field_raises():
    fake_sock = MagicMock()
    with patch("socket.create_connection", return_value=fake_sock):
        printer = make_printer()
        printer.connect()
        with pytest.raises(PrinterError):
            printer.send_print_job({"batch": "B123"})  # missing exp_date


def test_get_status_returns_decoded_reply():
    fake_sock = MagicMock()
    fake_sock.recv.return_value = b"READY,INK=80%\n"
    with patch("socket.create_connection", return_value=fake_sock):
        printer = make_printer()
        printer.connect()
        status = printer.get_status()

    assert status == "READY,INK=80%"
