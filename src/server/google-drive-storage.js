// ==============================================================================
// TRANSMOVE GOOGLE DRIVE FILE STORAGE SERVICE
// Server-side storage for:
// - payment proof images
// - verification documents (driver licences, national IDs)
// - vehicle photos & documents
// - receipts & exports
// - automated database backups
//
// Google credentials remain strictly server-side.
// Files remain PRIVATE — authorized access is brokered through trusted backend.
// Supports both live Google Drive API and secure local disk driver fallback.
// ==============================================================================

import fs from "fs";
import path from "path";
import { Readable } from "stream";

// Standard TransMove Drive Folder Hierarchy
export const DRIVE_FOLDERS = {
  PAYMENTS_SUBSCRIPTIONS: "TransMove/Payments/Subscriptions",
  PAYMENTS_ADVERTISING: "TransMove/Payments/Advertising",
  PAYMENTS_TRIPS: "TransMove/Payments/Trips",
  VERIFICATION_DRIVERS: "TransMove/Verification/Drivers",
  VEHICLES: "TransMove/Vehicles",
  RECEIPTS: "TransMove/Receipts",
  EXPORTS: "TransMove/Exports",
  BACKUPS: "TransMove/Backups"
};

class GoogleDriveStorageService {
  constructor() {
    this.driveClient = null;
    this.authClient = null;
    this.folderCache = new Map();
    this.isLive = false;
    this.localStoragePath = path.resolve(process.cwd(), "storage", "google_drive_local");
    this._init();
  }

  _init() {
    try {
      const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      let privateKey = process.env.GOOGLE_PRIVATE_KEY;
      const jsonCreds = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

      let credentials = null;
      if (jsonCreds) {
        try {
          if (fs.existsSync(jsonCreds)) {
            credentials = JSON.parse(fs.readFileSync(jsonCreds, "utf8"));
          } else {
            credentials = JSON.parse(jsonCreds);
          }
        } catch (_) {}
      }

      if (credentials) {
        this._setupGoogleAuth(credentials.client_email, credentials.private_key);
      } else if (email && privateKey) {
        if (privateKey.includes("\\n")) {
          privateKey = privateKey.replace(/\\n/g, "\n");
        }
        this._setupGoogleAuth(email, privateKey);
      } else {
        // Local fallback driver
        this._setupLocalFallback();
      }
    } catch (err) {
      console.warn("[GoogleDriveService] Notice initializing Google Drive:", err.message);
      this._setupLocalFallback();
    }
  }

  _setupGoogleAuth(email, privateKey) {
    try {
      // Dynamic import to avoid crash if googleapis is not yet installed
      const { google } = require("googleapis");
      this.authClient = new google.auth.JWT({
        email,
        key: privateKey,
        scopes: ["https://www.googleapis.com/auth/drive"]
      });
      this.driveClient = google.drive({ version: "v3", auth: this.authClient });
      this.isLive = true;
      console.log("[GoogleDriveService] Initialized with Google Service Account:", email);
    } catch (err) {
      console.warn("[GoogleDriveService] googleapis not available yet, using local storage fallback:", err.message);
      this._setupLocalFallback();
    }
  }

  _setupLocalFallback() {
    this.isLive = false;
    if (!fs.existsSync(this.localStoragePath)) {
      fs.mkdirSync(this.localStoragePath, { recursive: true });
    }
    // Pre-create standard folders
    for (const folder of Object.values(DRIVE_FOLDERS)) {
      const dir = path.join(this.localStoragePath, ...folder.split("/"));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    console.log("[GoogleDriveService] Initialized local private storage at:", this.localStoragePath);
  }

  /**
   * Creates or resolves nested folder path on Google Drive or local storage
   */
  async createFolderIfNeeded(folderPath) {
    if (!folderPath) return null;
    const normalized = folderPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");

    if (this.folderCache.has(normalized)) {
      return this.folderCache.get(normalized);
    }

    if (!this.isLive || !this.driveClient) {
      const fullDir = path.join(this.localStoragePath, ...normalized.split("/"));
      if (!fs.existsSync(fullDir)) {
        fs.mkdirSync(fullDir, { recursive: true });
      }
      this.folderCache.set(normalized, normalized);
      return normalized;
    }

    const segments = normalized.split("/");
    let parentId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || "root";

    for (const segment of segments) {
      const cacheKey = `${parentId}/${segment}`;
      if (this.folderCache.has(cacheKey)) {
        parentId = this.folderCache.get(cacheKey);
        continue;
      }

      // Query for existing folder under parent
      const q = `name = '${segment}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`;
      const listRes = await this.driveClient.files.list({
        q,
        fields: "files(id, name)",
        spaces: "drive"
      });

      if (listRes.data.files && listRes.data.files.length > 0) {
        parentId = listRes.data.files[0].id;
      } else {
        // Create folder
        const createRes = await this.driveClient.files.create({
          resource: {
            name: segment,
            mimeType: "application/vnd.google-apps.folder",
            parents: [parentId]
          },
          fields: "id"
        });
        parentId = createRes.data.id;
      }
      this.folderCache.set(cacheKey, parentId);
    }

    this.folderCache.set(normalized, parentId);
    return parentId;
  }

  /**
   * Uploads a file buffer or stream to Google Drive
   *
   * @param {Object} options
   * @param {Buffer|Readable} options.buffer - File buffer or stream
   * @param {string} options.originalFilename - Original file name
   * @param {string} options.mimeType - File MIME type
   * @param {string} [options.folderPath] - Target folder path e.g. TransMove/Payments/Subscriptions
   * @param {Object} [options.metadata] - Extra metadata key/values
   * @returns {Promise<Object>} { id, name, mimeType, size, storage_provider }
   */
  async uploadFile({ buffer, stream, originalFilename, mimeType, folderPath = DRIVE_FOLDERS.RECEIPTS, metadata = {} }) {
    if (!originalFilename) throw new Error("Google Drive upload requires originalFilename.");
    const safeFilename = path.basename(originalFilename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const mime = mimeType || "application/octet-stream";

    // Handle Local Fallback
    if (!this.isLive || !this.driveClient) {
      await this.createFolderIfNeeded(folderPath);
      const uniquePrefix = `gd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const storedName = `${uniquePrefix}_${safeFilename}`;
      const targetDir = path.join(this.localStoragePath, ...folderPath.split("/"));
      const targetFilePath = path.join(targetDir, storedName);

      let fileSize = 0;
      if (buffer) {
        const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
        fs.writeFileSync(targetFilePath, buf);
        fileSize = buf.length;
      } else if (stream) {
        const writeStream = fs.createWriteStream(targetFilePath);
        await new Promise((resolve, reject) => {
          stream.pipe(writeStream);
          stream.on("end", resolve);
          stream.on("error", reject);
        });
        fileSize = fs.statSync(targetFilePath).size;
      } else {
        throw new Error("No buffer or stream provided for upload.");
      }

      // Store local metadata sidecar
      const metaPath = `${targetFilePath}.meta.json`;
      const metaObj = {
        id: storedName,
        originalFilename,
        mimeType: mime,
        size: fileSize,
        folderPath,
        uploadedAt: new Date().toISOString(),
        customMetadata: metadata
      };
      fs.writeFileSync(metaPath, JSON.stringify(metaObj, null, 2), "utf8");

      return {
        id: storedName,
        name: originalFilename,
        mimeType: mime,
        size: fileSize,
        storage_provider: "google_drive",
        folderPath,
        is_mock: true
      };
    }

    // Handle Live Google Drive API
    const folderId = await this.createFolderIfNeeded(folderPath);

    let mediaBody;
    if (stream) {
      mediaBody = stream;
    } else if (buffer) {
      const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
      mediaBody = Readable.from(buf);
    } else {
      throw new Error("No buffer or stream provided for Google Drive upload.");
    }

    const fileMetadata = {
      name: safeFilename,
      parents: [folderId],
      properties: {
        originalFilename,
        uploadedAt: new Date().toISOString(),
        ...metadata
      }
    };

    const res = await this.driveClient.files.create({
      resource: fileMetadata,
      media: {
        mimeType: mime,
        body: mediaBody
      },
      fields: "id, name, mimeType, size, createdTime"
    });

    return {
      id: res.data.id,
      name: res.data.name || originalFilename,
      mimeType: res.data.mimeType || mime,
      size: parseInt(res.data.size || "0", 10),
      storage_provider: "google_drive",
      folderPath,
      is_mock: false
    };
  }

  /**
   * Retrieves file metadata
   */
  async getFileMetadata(fileId) {
    if (!fileId) throw new Error("Missing fileId parameter.");

    if (!this.isLive || !this.driveClient) {
      // Search in local storage
      const found = this._findLocalFile(fileId);
      if (!found) {
        const error = new Error(`File ${fileId} not found in local Google Drive storage.`);
        error.code = 404;
        throw error;
      }
      return found.meta;
    }

    const res = await this.driveClient.files.get({
      fileId,
      fields: "id, name, mimeType, size, createdTime, properties"
    });

    return {
      id: res.data.id,
      name: res.data.name,
      mimeType: res.data.mimeType,
      size: parseInt(res.data.size || "0", 10),
      createdTime: res.data.createdTime,
      metadata: res.data.properties || {}
    };
  }

  /**
   * Downloads an authorized file stream (never exposes public link)
   */
  async downloadAuthorizedFile(fileId) {
    if (!fileId) throw new Error("Missing fileId parameter.");

    if (!this.isLive || !this.driveClient) {
      const found = this._findLocalFile(fileId);
      if (!found) {
        const error = new Error(`File ${fileId} not found in local Google Drive storage.`);
        error.code = 404;
        throw error;
      }
      return {
        stream: fs.createReadStream(found.filePath),
        mimeType: found.meta.mimeType || "application/octet-stream",
        filename: found.meta.originalFilename || found.meta.name,
        size: found.meta.size
      };
    }

    const meta = await this.getFileMetadata(fileId);
    const res = await this.driveClient.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );

    return {
      stream: res.data,
      mimeType: meta.mimeType || "application/octet-stream",
      filename: meta.name,
      size: meta.size
    };
  }

  /**
   * Deletes a file from Google Drive
   */
  async deleteFile(fileId) {
    if (!fileId) return;

    if (!this.isLive || !this.driveClient) {
      const found = this._findLocalFile(fileId);
      if (found) {
        if (fs.existsSync(found.filePath)) fs.unlinkSync(found.filePath);
        if (fs.existsSync(found.metaPath)) fs.unlinkSync(found.metaPath);
      }
      return;
    }

    try {
      await this.driveClient.files.delete({ fileId });
    } catch (err) {
      if (err.code !== 404) throw err;
    }
  }

  _findLocalFile(fileId) {
    const searchDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const res = searchDir(full);
          if (res) return res;
        } else if (entry.name === fileId) {
          const metaPath = `${full}.meta.json`;
          let meta = { id: fileId, name: fileId, size: fs.statSync(full).size };
          if (fs.existsSync(metaPath)) {
            try {
              meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
            } catch (_) {}
          }
          return { filePath: full, metaPath, meta };
        }
      }
      return null;
    };

    return searchDir(this.localStoragePath);
  }
}

export const googleDriveStorage = new GoogleDriveStorageService();
