const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

function activate(context) {
    vscode.commands.executeCommand('workbench.action.closeSidebar');
    vscode.window.showInformationMessage('URI Range Opener activated!');

    // Create hidden webview to read URL hash
    const panel = vscode.window.createWebviewPanel(
        'uriReader',
        'URI Reader',
        { viewColumn: vscode.ViewColumn.Active, preserveFocus: true },
        { enableScripts: true }
    );

    panel.webview.html = `<!DOCTYPE html>
    <html>
    <body>
    <script>
        const vscode = acquireVsCodeApi();

        function parseHash(hash) {
            if (!hash) return null;
            if (hash.startsWith('#sel=')) {
                const content = hash.slice(5);
                const solo = content.includes('&solo');
                const sel = decodeURIComponent(content.replace('&solo', ''));
                return { type: 'selection', sel, solo };
            }
            if (hash.startsWith('#url=')) {
                const params = new URLSearchParams(hash.slice(1));
                const url = params.get('url');
                const name = params.get('name') || 'document';
                if (url) return { type: 'fetch-url', url, name };
            }
            return null;
        }

        function checkHash() {
            let hash = window.location.hash;
            try { hash = window.top.location.hash || hash; } catch(e) {}
            const parsed = parseHash(hash);
            if (!parsed) return;
            vscode.postMessage(parsed.type === 'selection'
                ? { type: 'selection', data: parsed.sel, solo: parsed.solo }
                : { type: 'fetch-url', url: parsed.url, name: parsed.name });
        }

        checkHash();
        window.addEventListener('hashchange', checkHash);

        // Close after checking if nothing matched
        setTimeout(() => vscode.postMessage({ type: 'done' }), 500);
    </script>
    </body>
    </html>`;

    panel.webview.onDidReceiveMessage(async (msg) => {
        if (msg.type === 'selection' && msg.data) {
            const match = msg.data.match(/^(.+):(\d+):(\d+):(\d+):(\d+)$/);
            if (match) {
                const [, file, sl, sc, el, ec] = match;
                panel.dispose();
                if (msg.solo) {
                    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
                }
                await openFileWithRange(file, parseInt(sl), parseInt(sc), parseInt(el), parseInt(ec));
                return;
            }
        }
        if (msg.type === 'fetch-url' && msg.url) {
            panel.dispose();
            await fetchAndOpen(msg.url, msg.name);
            return;
        }
        if (msg.type === 'done') {
            panel.dispose();
        }
    });

    // Command for manual trigger
    const command = vscode.commands.registerCommand('uri-opener.openRange', async (args) => {
        if (!args || !args.file) {
            vscode.window.showErrorMessage('uri-opener.openRange: missing file argument');
            return;
        }
        await openFileWithRange(args.file, args.sl, args.sc, args.el, args.ec);
    });

    // UriHandler for vscode:// URIs
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
    const startLine = Math.max(0, sl - 1);
    const startChar = Math.max(0, sc - 1);
    const endLine = Math.max(0, el - 1);
    const endChar = Math.max(0, ec - 1);

    const selection = new vscode.Selection(
        new vscode.Position(startLine, startChar),
        new vscode.Position(endLine, endChar)
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
