/** A processed image ready to store on a Media node. */
export interface ProcessedImage {
  src: string; // data URL
  width: number;
  height: number;
  name: string;
}

const MAX_DIM = 1600; // cap longest edge so base64 stays localStorage-friendly
const JPEG_QUALITY = 0.85;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode the image."));
    img.src = src;
  });
}

/**
 * Read an image file, downscaling it to a sane size so the data URL doesn't
 * blow the localStorage budget. Returns the original if already small enough.
 */
export async function processImageFile(file: File): Promise<ProcessedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("That file isn't an image.");
  }
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const longest = Math.max(img.width, img.height);

  if (longest <= MAX_DIM) {
    return { src: dataUrl, width: img.width, height: img.height, name: file.name };
  }

  const scale = MAX_DIM / longest;
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { src: dataUrl, width: img.width, height: img.height, name: file.name };
  ctx.drawImage(img, 0, 0, width, height);
  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  const src = canvas.toDataURL(mime, JPEG_QUALITY);
  return { src, width, height, name: file.name };
}
