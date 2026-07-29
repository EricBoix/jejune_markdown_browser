const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const http = require('http');

function activate(context) {
    vscode.commands.executeCommand('workbench.action.closeSidebar');

    startTriggerServer(context);

    const command = vscode.commands.registerCommand('uri-opener.openRange', async (args) => {
        if (!args || !args.file) {
            vscode.window.showErrorMessage('uri-opener.openRange: missing file argument');
            return;
        }
        await openFileWithRange(args.file, args.sl, args.sc, args.el, args.ec);
    });

    const uriHandler = vscode.window.registerUriHandler({
        handleUri(uri) {
            const params = new URLSearchParams(uri.query);
            const file = params.get('file');
            if (file) {
                openFileWithRange(
                    file,
                    parseInt(params.get('sl')) || 1,
                    parseInt(params.get('sc')) || 1,
                    parseInt(params.get('el')) || 1,
                    parseInt(params.get('ec')) || 1
                );
            }
        }
    });

    context.subscriptions.push(command, uriHandler);
}

function startTriggerServer(context) {
    const server = http.createServer((req, res) => {
        const cors = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
        };
        if (req.method === 'OPTIONS') {
            res.writeHead(204, cors);
            res.end();
            return;
        }
        try {
            const u = new URL(req.url, 'http://localhost');
            const url = u.searchParams.get('url');
            const name = u.searchParams.get('name');
            if (req.method === 'GET' && u.pathname === '/open' && url && name) {
                res.writeHead(200, { ...cors, 'Content-Type': 'text/plain' });
                res.end('ok');
                fetchAndOpen(url, name);
            } else {
                res.writeHead(404, cors);
                res.end();
            }
        } catch (e) {
            res.writeHead(500, cors);
            res.end(e.message);
        }
    });
    server.on('error', e => {
        if (e.code !== 'EADDRINUSE') {
            vscode.window.showErrorMessage(`uri-opener: trigger server error: ${e.message}`);
        }
    });
    server.listen(8085, '0.0.0.0');
    context.subscriptions.push({ dispose: () => server.close() });
}

function resolveInternalUrl(url) {
    const internalBase = process.env.DOCS_SERVER_INTERNAL_URL;
    if (!internalBase) return url;
    try {
        const parsed = new URL(url);
        return internalBase.replace(/\/$/, '') + parsed.pathname + parsed.search + parsed.hash;
    } catch (e) {
        return url;
    }
}

async function fetchAndOpen(url, name) {
    const destDir = '/config/docs-server';
    const destFile = path.join(destDir, `${name}.md`);
    try {
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        const content = await fetchUrl(resolveInternalUrl(url));
        fs.writeFileSync(destFile, content, 'utf8');
        await openFileWithRange(destFile, 1, 1, 1, 1);
    } catch (err) {
        vscode.window.showErrorMessage(`uri-opener: failed to load ${url}: ${err.message}`);
    }
}

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? require('https') : require('http');
        client.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
            res.on('error', reject);
        }).on('error', reject);
    });
}

async function openFileWithRange(file, sl = 1, sc = 1, el = sl, ec = sc) {
    const selection = new vscode.Selection(
        new vscode.Position(Math.max(0, sl - 1), Math.max(0, sc - 1)),
        new vscode.Position(Math.max(0, el - 1), Math.max(0, ec - 1))
    );
    try {
        const uri = vscode.Uri.file(file);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { selection, preview: false });
    } catch (err) {
        vscode.window.showErrorMessage(`uri-opener: ${err.message}`);
    }
}

function deactivate() {}

module.exports = { activate, deactivate };
