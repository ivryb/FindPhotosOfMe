export function authRedirect(value: unknown) {
  return typeof value === "string" && /^\/(?!\/)/.test(value) && !/[\\\x00-\x20]/.test(value)
    ? value
    : "/admin";
}
