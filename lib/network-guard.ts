import { BlockList, isIP } from "net";
import { lookup } from "dns/promises";

/**
 * Guards server-side outbound connections to user-supplied hosts (the live DB
 * import). On Vercel, "localhost" or a private address would point at our own
 * infrastructure, never at the user's machine, so those are refused outright.
 */

const blocked = new BlockList();
// IPv4: "this network", private, CGNAT, loopback, link-local (incl. cloud
// metadata 169.254.169.254), IETF protocol assignments, benchmarking,
// multicast and reserved.
blocked.addSubnet("0.0.0.0", 8, "ipv4");
blocked.addSubnet("10.0.0.0", 8, "ipv4");
blocked.addSubnet("100.64.0.0", 10, "ipv4");
blocked.addSubnet("127.0.0.0", 8, "ipv4");
blocked.addSubnet("169.254.0.0", 16, "ipv4");
blocked.addSubnet("172.16.0.0", 12, "ipv4");
blocked.addSubnet("192.0.0.0", 24, "ipv4");
blocked.addSubnet("192.168.0.0", 16, "ipv4");
blocked.addSubnet("198.18.0.0", 15, "ipv4");
blocked.addSubnet("224.0.0.0", 4, "ipv4");
blocked.addSubnet("240.0.0.0", 4, "ipv4");
// IPv6: unspecified, loopback, unique-local, link-local, multicast.
blocked.addAddress("::", "ipv6");
blocked.addAddress("::1", "ipv6");
blocked.addSubnet("fc00::", 7, "ipv6");
blocked.addSubnet("fe80::", 10, "ipv6");
blocked.addSubnet("ff00::", 8, "ipv6");

export function isPrivateAddress(address: string): boolean {
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) is checked as the IPv4 it wraps.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return isPrivateAddress(mapped[1]);

  const family = isIP(address);
  if (family === 4) return blocked.check(address, "ipv4");
  if (family === 6) return blocked.check(address, "ipv6");
  return true; // not an IP at all — refuse rather than guess
}

/**
 * Resolves `host` and returns an address that is safe to connect to. Callers
 * must connect to the returned address, not re-resolve `host`, so a DNS record
 * can't flip to a private IP between this check and the connection.
 */
export async function resolvePublicHost(host: string): Promise<string> {
  const trimmed = host.trim();
  if (!trimmed) throw new Error("Host is required.");

  const addresses = isIP(trimmed)
    ? [{ address: trimmed }]
    : await lookup(trimmed, { all: true }).catch(() => {
        throw new Error(`Could not resolve host "${trimmed}".`);
      });

  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error(
      "Private, local and internal addresses can't be reached from dbluna's servers. Use a publicly reachable database host.",
    );
  }
  return addresses[0].address;
}
