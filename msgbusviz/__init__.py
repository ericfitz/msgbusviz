"""Python client for the msgbusviz sidecar.

Connect to a running ``msgbusviz serve`` instance and fire ``sendMessage``
events that animate in the 3D viewer.
"""

from .client import (
    PROTOCOL_VERSION,
    Channel,
    Client,
    ClientError,
    Config,
    Node,
)

__version__ = "0.1.0"

__all__ = [
    "Client",
    "ClientError",
    "Config",
    "Channel",
    "Node",
    "PROTOCOL_VERSION",
    "__version__",
]
