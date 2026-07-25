import os
import urllib.error
import urllib.request

import click

from jejune_cli.plugin import JejunePlugin

_DEFAULT_PORT = "8443"
_CONFIG_VAR = "MARKDOWN_PORT"


def _check_availability() -> tuple[bool, str]:
    port = os.environ.get(_CONFIG_VAR, _DEFAULT_PORT)
    url = f"http://localhost:{port}/"
    try:
        urllib.request.urlopen(url, timeout=2)
        return True, f"responding on :{port}"
    except urllib.error.URLError as exc:
        return False, str(exc.reason)
    except Exception as exc:
        return False, str(exc)


@click.group("md-browser")
def md_browser_group():
    """Commands for the jejune markdown-browser UI component."""


@md_browser_group.command("status")
def status():
    """Check that the markdown-browser container is reachable."""
    ok, msg = _check_availability()
    symbol = click.style("ok", fg="green") if ok else click.style("error", fg="red")
    click.echo(f"md-browser  {symbol}  {msg}")


plugin = JejunePlugin(
    name="md-browser",
    group=md_browser_group,
    config_vars=[_CONFIG_VAR],
    config_hint=f"Set {_CONFIG_VAR} to the port exposed by the markdown-browser container (default {_DEFAULT_PORT}).",
    avail_hint="Run `docker compose up -d` in your SomeMac deployment directory.",
    check_availability=_check_availability,
    stage="extension",
)
