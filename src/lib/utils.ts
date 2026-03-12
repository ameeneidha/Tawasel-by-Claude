import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const EMAIL_LIKE_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function deriveNameFromEmail(email?: string | null) {
  const localPart = (email || '').split('@')[0]?.trim();
  if (!localPart) {
    return 'User';
  }

  return localPart
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

export function getDisplayName(name?: string | null, email?: string | null) {
  const trimmedName = name?.trim() || '';

  if (trimmedName && !EMAIL_LIKE_REGEX.test(trimmedName)) {
    return trimmedName;
  }

  if (email?.trim()) {
    return deriveNameFromEmail(email);
  }

  if (trimmedName) {
    return deriveNameFromEmail(trimmedName);
  }

  return 'User';
}
