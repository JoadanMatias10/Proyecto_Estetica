const CLOUDINARY_HOST_PATTERN = /^https?:\/\/res\.cloudinary\.com\//i;
const CLOUDINARY_UPLOAD_SEGMENT = "/image/upload/";

function normalizePositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

export function isCloudinaryImageUrl(value) {
  const url = String(value || "").trim();
  return CLOUDINARY_HOST_PATTERN.test(url) && url.includes(CLOUDINARY_UPLOAD_SEGMENT);
}

export function buildCloudinaryImageUrl(source, options = {}) {
  const url = String(source || "").trim();
  if (!isCloudinaryImageUrl(url)) return url;

  const width = normalizePositiveInteger(options.width);
  const height = normalizePositiveInteger(options.height);
  const transformations = [];

  if (options.crop) transformations.push(`c_${options.crop}`);
  if (options.gravity) transformations.push(`g_${options.gravity}`);
  if (width) transformations.push(`w_${width}`);
  if (height) transformations.push(`h_${height}`);
  if (options.format !== false) transformations.push("f_auto");
  if (options.quality !== false) transformations.push(`q_${options.quality || "auto"}`);

  if (transformations.length === 0) return url;

  const uploadIndex = url.indexOf(CLOUDINARY_UPLOAD_SEGMENT);
  const insertionPoint = uploadIndex + CLOUDINARY_UPLOAD_SEGMENT.length;
  return `${url.slice(0, insertionPoint)}${transformations.join(",")}/${url.slice(insertionPoint)}`;
}

export function buildCloudinarySrcSet(source, variants, options = {}) {
  if (!isCloudinaryImageUrl(source) || !Array.isArray(variants)) return "";

  return variants
    .map((variant) => {
      const descriptorWidth = normalizePositiveInteger(
        typeof variant === "number" ? variant : variant?.width
      );
      if (!descriptorWidth) return "";

      const height = normalizePositiveInteger(
        typeof variant === "number" ? null : variant?.height
      );
      const transformedUrl = buildCloudinaryImageUrl(source, {
        ...options,
        width: descriptorWidth,
        ...(height ? { height } : {}),
      });

      return `${transformedUrl} ${descriptorWidth}w`;
    })
    .filter(Boolean)
    .join(", ");
}
