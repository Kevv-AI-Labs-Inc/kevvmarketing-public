"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

type UploadField = "photo" | "hero" | "general";

type Props = {
  /** Current URL value */
  value: string;
  onChange: (url: string) => void;
  /** Which R2 path bucket to use */
  field: UploadField;
  /** Aspect ratio class e.g. "aspect-square" | "aspect-video" */
  previewClass?: string;
  label?: string;
  placeholder?: string;
};

/**
 * ImageUploadField — dual-mode: paste URL or pick file → direct PUT to R2.
 *
 * If R2 is not configured (dev env), falls back to URL-only mode with a notice.
 */
export function ImageUploadField({
  value,
  onChange,
  field,
  previewClass = "aspect-square",
  label,
  placeholder = "https://...",
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getUploadUrl = trpc.profile.getUploadUrl.useMutation();

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件（JPG、PNG、WebP 等）");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("文件不能超过 10 MB");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const result = await getUploadUrl.mutateAsync({
        field,
        filename: file.name,
        contentType: file.type,
      });

      if (!result.configured || !result.uploadUrl) {
        setError("R2 未配置，请直接粘贴图片 URL");
        setUploading(false);
        return;
      }

      // Direct PUT to R2 via presigned URL — no server traffic for the binary
      const res = await fetch(result.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!res.ok) throw new Error(`R2 upload failed: ${res.status}`);

      onChange(result.publicUrl!);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败，请重试");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Preview panel */}
      <div
        className={`relative overflow-hidden rounded-xl border border-border bg-muted/30 ${previewClass}`}
      >
        {value ? (
          <>
            <img
              alt={label ?? "preview"}
              className="h-full w-full object-cover"
              src={value}
            />
            {/* Clear button */}
            <button
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-foreground shadow backdrop-blur-sm transition-opacity hover:bg-background"
              type="button"
              onClick={() => onChange("")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageIcon className="h-6 w-6 opacity-40" />
            <span className="text-[11px]">无图片</span>
          </div>
        )}

        {/* Upload progress overlay */}
        {uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-xs font-medium">上传中…</span>
          </div>
        )}
      </div>

      {/* URL input row */}
      <div className="flex gap-2">
        <Input
          className="h-8 flex-1 font-mono text-xs"
          disabled={uploading}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />

        {/* Upload button */}
        <button
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          disabled={uploading}
          title="从本地上传"
          type="button"
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        accept="image/*"
        className="hidden"
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          // reset so same file can be re-selected
          e.target.value = "";
        }}
      />

      {/* Drag-and-drop zone
          (Clicking anywhere on preview already covered; this is for explicit drop) */}
      {error && (
        <p className="text-[11px] text-destructive">{error}</p>
      )}
    </div>
  );
}
