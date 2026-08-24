const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const http = require('http');

function activate(context) {
    vscode.commands.executeCommand('workbench.action.closeSidebar');
    startTriggerServer(context);
}

function startTriggerServer(context) {
    const server = http.createServer(async (req, res) => {
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
            if (req.method !== 'GET') {
                res.writeHead(404, cors);
                res.end();
                return;
            }
            if (u.pathname === '/fetch') {
                const url = u.searchParams.get('url');
                const name = u.searchParams.get('name');
                if (!url || !name) {
                    res.writeHead(400, cors);
                    res.end('missing url or name');
                    return;
                }
                const destDir = '/config/docs-server';
                const destFile = path.join(destDir, `${name}.md`);
                if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
                const content = await fetchUrl(resolveInternalUrl(url));
                fs.writeFileSync(destFile, content, 'utf8');
                const size = Buffer.byteLength(content, 'utf8');
                const text = u.searchParams.get('text');
                const range = text ? findRange(content, text) : null;
                const { sl = 1, sc = 1, el = 1, ec = 1 } = range ?? {};
                res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ file: destFile, size, sl, sc, el, ec }));
            } else if (u.pathname === '/highlight') {
                const file = u.searchParams.get('file');
                if (!file) {
                    res.writeHead(400, cors);
                    res.end('missing file');
                    return;
                }
                const sl = parseInt(u.searchParams.get('sl')) || 1;
                const sc = parseInt(u.searchParams.get('sc')) || 1;
                const el = parseInt(u.searchParams.get('el')) || sl;
                const ec = parseInt(u.searchParams.get('ec')) || sc;
                const solo = u.searchParams.get('solo') === '1';
                if (solo) {
                    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
                }
                await openFileWithRange(file, sl, sc, el, ec);
                res.writeHead(200, { ...cors, 'Content-Type': 'text/plain' });
                res.end('ok');
            } else if (u.pathname === '/openapi.yaml') {
                const spec = fs.readFileSync(path.join(__dirname, 'openapi.yaml'), 'utf8');
                res.writeHead(200, { ...cors, 'Content-Type': 'text/yaml' });
                res.end(spec);
            } else if (u.pathname === '/docs') {
                const html = fs.readFileSync(path.join(__dirname, 'docs.html'), 'utf8');
                res.writeHead(200, { ...cors, 'Content-Type': 'text/html' });
                res.end(html);
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
            vscode.window.showErrorMessage(`uri-highlight: trigger server error: ${e.message}`);
        }
    });
    server.listen(8085, '0.0.0.0');
    context.subscriptions.push({ dispose: () => server.close() });
}

function findRange(content, text) {
    const lines = content.split('\n');
    for (let l = 0; l < lines.length; l++) {
        const col = lines[l].indexOf(text);
        if (col !== -1)
            return { sl: l + 1, sc: col + 1, el: l + 1, ec: col + text.length + 1 };
    }
    return null;
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
        vscode.window.showErrorMessage(`uri-highlight: ${err.message}`);
    }
}

function deactivate() {}

module.exports = { activate, deactivate };
