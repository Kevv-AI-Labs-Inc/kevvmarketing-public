import { ENV } from "./env";

function normalizeOpenId(value: string | null | undefined) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("google_") ? trimmed.slice("google_".length) : trimmed;
}

export function isOwnerOpenId(openId: string | null | undefined) {
  const userId = normalizeOpenId(openId);
  const ownerId = normalizeOpenId(ENV.ownerOpenId);
  if (!userId || !ownerId) return false;
  return userId === ownerId;
}

