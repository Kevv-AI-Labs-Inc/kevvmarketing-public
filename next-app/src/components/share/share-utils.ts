import type React from "react";

/**
 * Build CSS custom properties from an agent accent color.
 * Returns a CSSProperties object to spread on a wrapper div,
 * making colors available via var(--share-accent), etc.
 */
export function getShareAccentVars(color?: string): React.CSSProperties {
  const c = color && /^#[0-9a-f]{3,8}$/i.test(color) ? color : "#0d9488";
  return {
    "--share-accent": c,
    "--share-accent-light": `${c}1a`, // 10% opacity
    "--share-accent-border": `${c}40`, // 25% opacity
  } as React.CSSProperties;
}
