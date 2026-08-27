import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const types = new Map([[".html", "text/html; charset=utf-8"], [".css", "text/css; charset=utf-8"], [".js", "text/javascript; charset=utf-8"], [".json", "application/json"]]);

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const path = resolve(root, `.${pathname}`);
    if (path !== root && !path.startsWith(`${root}${sep}`)) throw new Error("outside root");
    const info = await stat(path);
    if (!info.isFile()) throw new Error("not a file");
    response.writeHead(200, { "content-type": types.get(extname(path)) ?? "application/octet-stream", "cache-control": "no-store" });
    createReadStream(path).pipe(response);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("not found");
  }
}).listen(4179, "127.0.0.1", () => process.stdout.write("design fixture: http://127.0.0.1:4179\n"));

