import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Files under /assets have a content hash in their name, so a given URL
  // never changes: browsers may cache them for a year. Everything else
  // (index.html, favicon) is always revalidated, so an update is picked up
  // on the next page load.
  app.use(
    express.static(distPath, {
      index: false,
      setHeaders: (res, filePath) => {
        const isHashedAsset = filePath.includes(`${path.sep}assets${path.sep}`);
        res.setHeader("Cache-Control", isHashedAsset ? "public, max-age=31536000, immutable" : "no-cache");
      },
    }),
  );

  // A missing asset is a 404, not the app shell. After an update, a browser
  // tab that was already open asks for the previous build's script files;
  // answering with index.html (as the catch-all below would) makes the
  // browser reject it as "not JavaScript" and leaves a blank page. A clean
  // 404 lets the client reload instead.
  app.use("/assets", (_req, res) => {
    res.status(404).type("text/plain").send("Not found");
  });

  // Every other path is a client-side route: serve the app shell.
  app.use("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
