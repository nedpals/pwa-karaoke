const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The origin a phone should open to reach this server. A display opened at
 * localhost would otherwise hand phones an address that only works on the
 * display itself, so swap in the server's LAN address when it reported one.
 */
export function getControllerOrigin(lanIp?: string | null): string {
  const { protocol, hostname, port, origin } = window.location;
  if (!lanIp || !LOOPBACK_HOSTS.has(hostname)) return origin;
  return `${protocol}//${lanIp}${port ? `:${port}` : ""}`;
}
