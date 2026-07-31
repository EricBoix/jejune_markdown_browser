import os
import urllib.error
import urllib.request

import click

from jejune_cli.plugin import JejunePlugin

_DEFAULT_PORT = "8443"
_DEFAULT_API_PORT = "8085"
_CONFIG_VAR = "MARKDOWN_PORT"
_API_CONFIG_VAR = "MARKDOWN_API_PORT"


def _probe(port: str) -> tuple[bool, str]:
    url = f"http://localhost:{port}/"
    try:
        urllib.request.urlopen(url, timeout=2)
        return True, f"responding on :{port}"
    except urllib.error.URLError as exc:
        return False, str(exc.reason)
    except Exception as exc:
        return False, str(exc)


def _check_availability() -> tuple[bool, str]:
    port = os.environ.get(_CONFIG_VAR, _DEFAULT_PORT)
    return _probe(port)


@click.group("md-browser")
def md_browser_group():
    """Commands for the jejune markdown-browser UI component."""


@md_browser_group.command("status-availability")
def status_availability():
    """Show md-browser availability status (mirrors the doctor Status column)."""
    cs_port = os.environ.get(_CONFIG_VAR, _DEFAULT_PORT)
    api_port = os.environ.get(_API_CONFIG_VAR, _DEFAULT_API_PORT)
    cs_ok, _ = _probe(cs_port)
    if not cs_ok:
        click.echo(f"md-browser: {click.style('error', fg='red')} (container not running on :{cs_port})")
        return
    api_ok, _ = _probe(api_port)
    if not api_ok:
        click.echo(
            f"md-browser: {click.style('warning', fg='yellow')}"
            f" (open :{cs_port} in a browser to activate the extension API on :{api_port})"
        )
        return
    click.echo(f"md-browser: {click.style('ok', fg='green')}")


@md_browser_group.command("hint-availability")
def hint_availability():
    """Show how to start the markdown-browser container."""
    cs_port = os.environ.get(_CONFIG_VAR, _DEFAULT_PORT)
    api_port = os.environ.get(_API_CONFIG_VAR, _DEFAULT_API_PORT)
    cs_ok, _ = _probe(cs_port)
    if not cs_ok:
        click.echo("run `docker compose --env-file deployment.env up -d`")
        return
    api_ok, _ = _probe(api_port)
    if not api_ok:
        click.echo(f"open http://localhost:{cs_port} in a browser to activate the extension API")
        return
    click.echo(click.style("md-browser is reachable", fg="green"))


plugin = JejunePlugin(
    name="md-browser",
    group=md_browser_group,
    config_vars=[_CONFIG_VAR, _API_CONFIG_VAR],
    config_hint=(
        f"Set {_CONFIG_VAR} to the code-server port (default {_DEFAULT_PORT})"
        f" and {_API_CONFIG_VAR} to the extension API port (default {_DEFAULT_API_PORT})."
    ),
    avail_hint="Run `docker compose up -d` in your SomeMac deployment directory.",
    check_availability=_check_availability,
    stage="extension",
)
