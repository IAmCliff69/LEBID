// bcrypt (which hashes our passwords) only reads the first 72 BYTES.
// Symbols and emoji take more than one byte each.
export const MAX_PASSWORD_BYTES = 72;

export const PASSWORD_TOO_LONG_MESSAGE =
  "Password is too long. Use at most 72 characters (symbols and emoji count as more than one).";

export function passwordFitsLimit(value: string): boolean {
  return new TextEncoder().encode(value).length <= MAX_PASSWORD_BYTES;
}