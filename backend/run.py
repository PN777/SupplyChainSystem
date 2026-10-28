import os

from app import create_app

app = create_app()

DEFAULT_PORT = 5001


def resolve_port():
    """Return a usable HTTP port.

    Some hosts export PORT=0 (auto-assign) or leave it unset. Binding an
    auto-assigned port would hide the API from the frontend, which always
    talks to the documented local port, so invalid values fall back to the
    default.
    """
    try:
        port = int(os.environ.get("PORT", DEFAULT_PORT))
    except (TypeError, ValueError):
        return DEFAULT_PORT
    if port < 1 or port > 65535:
        return DEFAULT_PORT
    return port


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=resolve_port(), debug=True)
