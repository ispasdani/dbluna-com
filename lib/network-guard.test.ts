import { describe, it, expect } from "vitest";
import { isPrivateAddress, resolvePublicHost } from "./network-guard";

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "::",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "not-an-ip",
  ])("blocks %s", (addr) => {
    expect(isPrivateAddress(addr)).toBe(true);
  });

  it.each(["8.8.8.8", "172.32.0.1", "52.1.2.3", "2606:4700:4700::1111", "::ffff:8.8.8.8"])(
    "allows %s",
    (addr) => {
      expect(isPrivateAddress(addr)).toBe(false);
    },
  );
});

describe("resolvePublicHost", () => {
  it("returns a public IP literal unchanged", async () => {
    await expect(resolvePublicHost(" 8.8.8.8 ")).resolves.toBe("8.8.8.8");
  });

  it("refuses localhost by name", async () => {
    await expect(resolvePublicHost("localhost")).rejects.toThrow(/Private, local/);
  });

  it("refuses private IP literals", async () => {
    await expect(resolvePublicHost("192.168.0.10")).rejects.toThrow(/Private, local/);
  });

  it("refuses an empty host", async () => {
    await expect(resolvePublicHost("  ")).rejects.toThrow(/required/);
  });
});
