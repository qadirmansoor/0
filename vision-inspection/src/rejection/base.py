from abc import ABC, abstractmethod


class RejectionError(Exception):
    """Raised for reject-actuator connect/trigger failures."""


class RejectionControllerBase(ABC):
    """Common interface for the hardware that physically ejects a bad unit
    from the line (Arduino, Raspberry Pi GPIO, or a PLC)."""

    def __init__(self, name: str):
        self.name = name
        self._connected = False

    @property
    def is_connected(self) -> bool:
        return self._connected

    @abstractmethod
    def connect(self) -> None:
        ...

    @abstractmethod
    def disconnect(self) -> None:
        ...

    @abstractmethod
    def trigger_reject(self, pulse_ms: int) -> None:
        """Activate the reject actuator (solenoid/air-blast/pusher) for pulse_ms milliseconds.

        Implementations should return once the actuation has been *started*
        (they may run the timed release asynchronously) rather than
        blocking the whole pulse duration, so the caller's control loop
        isn't stalled.
        """

    @abstractmethod
    def get_status(self) -> dict:
        ...

    def __enter__(self) -> "RejectionControllerBase":
        self.connect()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.disconnect()
