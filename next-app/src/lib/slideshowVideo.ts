export type StudioAspectRatio = "9:16" | "16:9" | "1:1";

export type SlideshowRenderProgress = {
  phase: "loading" | "rendering";
  loadedImages: number;
  totalImages: number;
  renderedFrames: number;
  totalFrames: number;
  percent: number;
};

export type RenderSlideshowVideoOptions = {
  imageUrls: string[];
  width: number;
  height: number;
  fps: number;
  secondsPerImage: number;
  bitrateMbps?: number;
  onProgress?: (progress: SlideshowRenderProgress) => void;
};

export type RenderSlideshowVideoResult = {
  blob: Blob;
  mimeType: string;
  extension: "webm" | "mp4";
  imageCount: number;
  frameCount: number;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function pickMediaRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4;codecs=h264",
    "video/mp4",
  ];
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return "";
}

function inferExtensionFromMimeType(mimeType: string): "webm" | "mp4" {
  return mimeType.toLowerCase().includes("mp4") ? "mp4" : "webm";
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number,
  zoom = 1
) {
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, width, height);

  const imageWidth = img.naturalWidth || img.width;
  const imageHeight = img.naturalHeight || img.height;

  if (!imageWidth || !imageHeight) return;

  const canvasRatio = width / height;
  const imageRatio = imageWidth / imageHeight;
  let drawWidth = width;
  let drawHeight = height;

  if (imageRatio > canvasRatio) {
    drawHeight = height * zoom;
    drawWidth = drawHeight * imageRatio;
  } else {
    drawWidth = width * zoom;
    drawHeight = drawWidth / imageRatio;
  }

  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;

  ctx.drawImage(img, x, y, drawWidth, drawHeight);
}

export async function renderSlideshowVideo(
  options: RenderSlideshowVideoOptions
): Promise<RenderSlideshowVideoResult> {
  if (typeof window === "undefined") {
    throw new Error("Slideshow rendering is only available in browser");
  }
  if (typeof MediaRecorder === "undefined") {
    throw new Error("Current browser does not support MediaRecorder");
  }
  if (options.imageUrls.length === 0) {
    throw new Error("No images available for slideshow");
  }
  if (options.width <= 0 || options.height <= 0) {
    throw new Error("Invalid render dimensions");
  }

  const canvas = document.createElement("canvas");
  canvas.width = options.width;
  canvas.height = options.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to initialize canvas renderer");
  }

  const fps = Math.max(10, Math.min(60, Math.round(options.fps)));
  const secondsPerImage = Math.max(0.5, Math.min(12, options.secondsPerImage));
  const frameIntervalMs = Math.max(8, Math.round(1000 / fps));
  const framesPerImage = Math.max(1, Math.round(fps * secondsPerImage));
  const transitionFrames = Math.max(
    1,
    Math.min(Math.round(fps * 0.35), Math.floor(framesPerImage / 2))
  );

  const stream = canvas.captureStream(fps);
  const preferredMimeType = pickMediaRecorderMimeType();
  const recorderOptions: MediaRecorderOptions = {};
  if (preferredMimeType) recorderOptions.mimeType = preferredMimeType;
  if (options.bitrateMbps && options.bitrateMbps > 0) {
    recorderOptions.videoBitsPerSecond = Math.round(options.bitrateMbps * 1_000_000);
  }

  const recorder = new MediaRecorder(stream, recorderOptions);
  const chunks: BlobPart[] = [];

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const fallbackType = preferredMimeType || "video/webm";
      resolve(new Blob(chunks, { type: fallbackType }));
    };
    recorder.onerror = () => {
      reject(new Error("Failed while recording slideshow video"));
    };
  });

  recorder.start(1000);

  const loadedImages: HTMLImageElement[] = [];
  for (let i = 0; i < options.imageUrls.length; i += 1) {
    const url = options.imageUrls[i];
    try {
      const image = await loadImage(url);
      loadedImages.push(image);
    } catch {
      // Skip broken images so the whole render can continue.
    }
    const loadingPercent = Math.min(
      15,
      (loadedImages.length / Math.max(1, options.imageUrls.length)) * 15
    );
    options.onProgress?.({
      phase: "loading",
      loadedImages: loadedImages.length,
      totalImages: options.imageUrls.length,
      renderedFrames: 0,
      totalFrames: 0,
      percent: loadingPercent,
    });
  }

  if (loadedImages.length === 0) {
    recorder.stop();
    throw new Error("All images failed to load");
  }

  const totalFrames = loadedImages.length * framesPerImage;
  let renderedFrames = 0;

  for (let index = 0; index < loadedImages.length; index += 1) {
    const current = loadedImages[index];
    const next = loadedImages[index + 1] ?? null;

    for (let frame = 0; frame < framesPerImage; frame += 1) {
      ctx.save();
      const zoom = 1 + (frame / Math.max(1, framesPerImage - 1)) * 0.06;
      drawImageCover(ctx, current, options.width, options.height, zoom);

      if (next && frame >= framesPerImage - transitionFrames) {
        const mix =
          (frame - (framesPerImage - transitionFrames) + 1) /
          (transitionFrames + 1);
        ctx.globalAlpha = Math.min(1, Math.max(0, mix));
        drawImageCover(ctx, next, options.width, options.height, 1);
      }
      ctx.restore();

      renderedFrames += 1;
      const percent =
        15 + (renderedFrames / Math.max(1, totalFrames)) * 85;
      options.onProgress?.({
        phase: "rendering",
        loadedImages: loadedImages.length,
        totalImages: loadedImages.length,
        renderedFrames,
        totalFrames,
        percent: Math.min(100, percent),
      });
      await sleep(frameIntervalMs);
    }
  }

  recorder.stop();
  const blob = await done;
  const mimeType = blob.type || preferredMimeType || "video/webm";

  return {
    blob,
    mimeType,
    extension: inferExtensionFromMimeType(mimeType),
    imageCount: loadedImages.length,
    frameCount: totalFrames,
  };
}

export function resolveVideoDimensions(aspectRatio: StudioAspectRatio): {
  width: number;
  height: number;
} {
  switch (aspectRatio) {
    case "16:9":
      return { width: 1920, height: 1080 };
    case "1:1":
      return { width: 1080, height: 1080 };
    case "9:16":
    default:
      return { width: 1080, height: 1920 };
  }
}
