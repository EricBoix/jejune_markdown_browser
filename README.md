# Highlight a document (with code-server)!-- omit in toc -->

## Table of content<!-- omit in toc -->

- [Highlight a document (with code-server)!-- omit in toc --\>](#highlight-a-document-with-code-server---omit-in-toc---)
  - [Introduction](#introduction)
  - [Quick Start](#quick-start)
  - [Warning](#warning)
  - [Health check](#health-check)
  - [Usage examples](#usage-examples)
  - [Testing things a bit more deeply](#testing-things-a-bit-more-deeply)
  - [How It Works](#how-it-works)
  - [Rebuilding the Extension](#rebuilding-the-extension)

## Introduction

This component displays markdown files with range selection via an HTTP API. Based on [docker based containerization](https://hub.docker.com/r/linuxserver/code-server) of the [code-server (aka coder)](https://coder.com/) (VS Code running on a remote server, accessible through the browser).

## Quick Start

```bash
# Build image (one-time)
docker build -t jejune:markdown-browser DockerContext/
```

```bash
# Run container
docker run --rm -d -p 8443:8443 -p 8085:8085 --name jejune-markdown-browser -t jejune:markdown-browser
```

For persistent data (optional):

```bash
docker run -d -v /path/to/data:/config -p 8443:8443 -p 8085:8085 jejuneness:code-server-uri-opener
```

## Warning

Port 8085 is controlled by the VS Code extension, which only activates when a browser session first opens on 8443. In other always **always start with a visit to 8443 prior to using the HTTP API on 8085**.

## Health check

Install the check package once (requires `jejune_cli` to be installed):

```sh
python3.10 -m venv venv
source venv/bin/activate
uv pip install ./check
```

Then probe a running container:

```sh
python -m jejune_md_browser_check status-availability
```

The default port is `8443`. Override with `MARKDOWN_PORT`:

```sh
MARKDOWN_PORT=9443 python -m jejune_md_browser_check status
```

## Usage examples

The full API is documented interactively via Swagger UI at `http://127.0.0.1:8085/docs` once the container is running.

### GET /fetch

Fetches a remote markdown URL, saves it to `/config/docs-server/`, and returns the local path and size.

| Parameter | Description                              |
| --------- | ---------------------------------------- |
| `url`     | Remote URL of the markdown to fetch      |
| `name`    | Saved as `/config/docs-server/{name}.md` |

Response (JSON): `{"file": "<absolute-path>", "size": <bytes>}`

Try it with:

```bash
curl "http://127.0.0.1:8085/fetch?url=<remote-url>&name=my-doc"
```

### GET /highlight

Opens a local file in code-server with the specified character range highlighted.

| Parameter | Description                                          |
| --------- | ---------------------------------------------------- |
| `file`    | Absolute path to file (inside container)             |
| `sl`      | Start line (1-indexed)                               |
| `sc`      | Start column (1-indexed)                             |
| `el`      | End line (1-indexed)                                 |
| `ec`      | End column (1-indexed)                               |
| `solo`    | Optional: set to `1` to close all other editor tabs  |

Response: `ok`

Try to close all other editor tabs (`solo` option) and display a file :

```bash
curl "http://127.0.0.1:8085/highlight?file=/config/sample.md&sl=7&sc=1&el=10&ec=50&solo=1"
```

## Testing things a bit more deeply

Make sure that all generated files are properly out of the way by removing them with

```bash
git clean -Xdf
```

## How It Works

The `uri-highlight` VS Code extension activates on startup and starts an HTTP trigger server on port 8085. It exposes two endpoints:

- `GET /fetch`: fetches a remote markdown URL, saves it to `/config/docs-server/`, and returns the local path and file size. The response is sent only after the file is fully written.
- `GET /highlight`: opens a local file in code-server with the specified character range highlighted. The response is sent only after the VS Code API calls complete.

## Rebuilding the Extension

Only needed when modifying files in `my-ext/uri-highlight`:

```bash
cd DockerContext/my-ext/uri-highlight
yes | npx @vscode/vsce package --allow-missing-repository
```

and then proceed with [rebuilding the container image](#quick-start).
