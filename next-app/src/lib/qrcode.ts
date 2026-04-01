/**
 * QR Code generation utility.
 * Dynamic import only — never loaded on public pages.
 */

export async function generateQRDataUrl(
  url: string,
  options?: { width?: number; margin?: number }
): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(url, {
    width: options?.width ?? 400,
    margin: options?.margin ?? 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
