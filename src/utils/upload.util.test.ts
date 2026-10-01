import { afterEach, describe, expect, test } from "bun:test";
import { storageService } from "../lib/storage/storage.service.js";
import { assertSafeImage, uploadImages } from "./upload.util.js";

const originalUpload = storageService.upload.bind(storageService);
const originalDelete = storageService.delete.bind(storageService);
const file = (buffer: Buffer, mimetype = "image/png") => ({ buffer, mimetype, originalname: "image.png", size: buffer.length }) as Express.Multer.File;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

afterEach(() => {
  storageService.upload = originalUpload;
  storageService.delete = originalDelete;
});

describe("safe image uploads", () => {
  test("checks magic bytes instead of trusting MIME alone", () => {
    expect(() => assertSafeImage(file(Buffer.from("not an image")))).toThrow("valid JPEG, PNG, or WebP");
    expect(() => assertSafeImage(file(png))).not.toThrow();
  });

  test("cleans completed uploads when a later upload fails", async () => {
    const deleted: string[] = [];
    let calls = 0;
    storageService.upload = (async () => {
      calls += 1;
      if (calls === 2) throw new Error("cloud failure");
      return { url: "u", secureUrl: "u", publicId: "first", provider: "AWS_S3", bytes: 9, format: "png" };
    }) as typeof storageService.upload;
    storageService.delete = (async (id: string) => { deleted.push(id); return true; }) as typeof storageService.delete;
    await expect(uploadImages([file(png), file(png)], "test")).rejects.toThrow("cloud failure");
    expect(deleted).toEqual(["first"]);
  });

  test("compresses images to strictly <= 100 KB regardless of input size", async () => {
    // Generate a large 2000x2000 raw image
    const largePng = await import("sharp").then((s) =>
      s.default({
        create: {
          width: 2000,
          height: 2000,
          channels: 3,
          background: { r: 255, g: 100, b: 50 },
        },
      })
        .png()
        .toBuffer()
    );

    let uploadedSize = 0;
    storageService.upload = (async (storageFile: any) => {
      uploadedSize = storageFile.size;
      return { url: "u", secureUrl: "u", publicId: "p1", provider: "CLOUDINARY", bytes: storageFile.size, format: "jpg" };
    }) as typeof storageService.upload;

    await uploadImages([file(largePng)], "test");
    expect(uploadedSize).toBeGreaterThan(0);
    expect(uploadedSize).toBeLessThanOrEqual(100 * 1024);
  });
});

