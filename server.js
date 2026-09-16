import http from "http";
import fs from "fs";
import path from "path";
import { handler } from "./netlify/functions/trusted-api.js";

const PORT = process.env.PORT || 8080;
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split("?")[0];

  // Route Netlify serverless functions locally
  if (urlPath === "/.netlify/functions/trusted-api" || urlPath === "/api/trusted-api") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      const event = {
        httpMethod: req.method,
        headers: req.headers,
        body: body
      };

      try {
        const result = await handler(event, {});
        res.writeHead(result.statusCode, result.headers);
        res.end(result.body);
      } catch (err) {
        console.error("Server error handling trusted-api:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Static file serving
  let relativePath = urlPath === "/" ? "index.html" : urlPath.replace(/^\//, "");
  let filePath = path.resolve(process.cwd(), relativePath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
  }
});

server.listen(PORT, () => {
  console.log(`TransMove Server running at http://localhost:${PORT}`);
});
