/**
 * Embed snippet generators for the Home Value funnel.
 * Produces copyable code that agents paste into external websites.
 */

/**
 * Generate an <iframe> snippet that embeds the home value page directly.
 */
export function generateIframeSnippet(
  url: string,
  options?: { width?: string; height?: string }
): string {
  const width = options?.width ?? "100%";
  const height = options?.height ?? "700";
  return `<iframe src="${url}" width="${width}" height="${height}" style="border:none;border-radius:12px;" loading="lazy" allow="clipboard-write"></iframe>`;
}

/**
 * Generate a <script> snippet that dynamically inserts an iframe.
 * More portable for CMS environments that strip raw iframes.
 */
export function generateScriptSnippet(url: string): string {
  return `<script>(function(){var d=document,f=d.createElement('iframe');f.src='${url}';f.style.cssText='width:100%;height:700px;border:none;border-radius:12px';f.loading='lazy';f.allow='clipboard-write';var s=d.currentScript||d.scripts[d.scripts.length-1];s.parentNode.insertBefore(f,s);})()</script>`;
}
