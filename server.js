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
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json; charset=utf-8"
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

  // Authorized private file preview via Google Drive storage
  if (urlPath.startsWith("/api/files/preview/")) {
    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
    const fileId = parsedUrl.pathname.replace("/api/files/preview/", "").trim();
    const token = (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, "").trim() : null) ||
      parsedUrl.searchParams.get("token") ||
      parsedUrl.searchParams.get("jwt");

    try {
      const { supabaseBackendEngine } = await import("./src/server/supabase-backend.js");
      const { googleDriveStorage } = await import("./src/server/google-drive-storage.js");

      // Check if file is a sensitive verification document or payment proof
      let isVerifDoc = false;
      let isPaymentProof = false;
      let docOwnerId = null;

      if (supabaseBackendEngine.isLive && supabaseBackendEngine.supabaseAdmin) {
        try {
          const { data: vDoc } = await supabaseBackendEngine.supabaseAdmin
            .from("verification_documents")
            .select("id, user_id, drive_file_id")
            .or(`drive_file_id.eq.${fileId},id.eq.${fileId}`)
            .maybeSingle();
          if (vDoc) {
            isVerifDoc = true;
            docOwnerId = vDoc.user_id;
          }
        } catch (_) {}

        try {
          const { data: pDoc } = await supabaseBackendEngine.supabaseAdmin
            .from("payments")
            .select("id, user_id, proof_file_id")
            .or(`proof_file_id.eq.${fileId},id.eq.${fileId}`)
            .maybeSingle();
          if (pDoc) {
            isPaymentProof = true;
            docOwnerId = pDoc.user_id;
          }
        } catch (_) {}
      }

      if (!isVerifDoc && !isPaymentProof) {
        const localVDoc = (supabaseBackendEngine.db?.verification_documents || []).find(
          (d) => (d.drive_file_id || d.file_id || d.id) === fileId
        );
        if (localVDoc) {
          isVerifDoc = true;
          docOwnerId = localVDoc.user_id;
        }
        const localPDoc = (supabaseBackendEngine.db?.payments || []).find(
          (p) => (p.proof_file_id || p.id) === fileId
        );
        if (localPDoc) {
          isPaymentProof = true;
          docOwnerId = localPDoc.user_id;
        }
      }

      if (isVerifDoc || isPaymentProof) {
        if (!token) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Authentication required to view confidential document." }));
          return;
        }

        let caller = null;
        try {
          caller = await supabaseBackendEngine.authenticateUser(token);
        } catch (_) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid authentication token." }));
          return;
        }

        const profile = await supabaseBackendEngine.getCallerProfile(caller.id);
        const isAdmin = profile?.role === "admin";
        const isOwner = docOwnerId && (caller.id === docOwnerId || caller.$id === docOwnerId);

        if (!isAdmin && !isOwner) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Forbidden: You do not have permission to view this document." }));
          return;
        }
      }

      const fileData = await googleDriveStorage.downloadAuthorizedFile(fileId);
      res.writeHead(200, {
        "Content-Type": fileData.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${fileData.filename}"`
      });
      fileData.stream.pipe(res);
      return;
    } catch (err) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message || "File not found." }));
      return;
    }
  }

  // Safe public configuration for browser frontend
  if (urlPath === "/api/config" || urlPath === "/api/public-config") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      supabaseUrl: process.env.SUPABASE_URL || "https://wwvnnnistexgyvhvnqes.supabase.co",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "sb_publishable__EpXdp1hPVYf-k0VSUF4Uw_5_rBEYm4",
      databaseProvider: "supabase",
      fileStorageProvider: "google_drive"
    }));
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
  console.log("Database provider: supabase");
  console.log("File storage provider: google_drive");
  console.log(`Supabase: ${process.env.SUPABASE_URL ? "configured" : "not configured"}`);
  console.log(`Google Drive OAuth: ${process.env.GOOGLE_OAUTH_REFRESH_TOKEN || process.env.GOOGLE_SERVICE_ACCOUNT_JSON ? "configured" : "not configured"}`);
});
