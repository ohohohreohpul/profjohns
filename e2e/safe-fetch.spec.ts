import { test, expect } from "@playwright/test";
import { isPublicAddress, assertPublicUrl } from "../src/lib/server/safe-fetch";

/**
 * SSRF guard for server-side fetches of user-supplied URLs (PDF proxy).
 * Private, loopback, link-local and metadata addresses must be refused.
 */
test.describe("isPublicAddress", () => {
  for (const ip of ["127.0.0.1", "10.0.0.5", "172.16.3.4", "172.31.255.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1"]) {
    test(`refuses ${ip}`, () => expect(isPublicAddress(ip)).toBe(false));
  }
  for (const ip of ["8.8.8.8", "140.82.112.3", "172.32.0.1", "2606:4700:4700::1111"]) {
    test(`allows ${ip}`, () => expect(isPublicAddress(ip)).toBe(true));
  }
});

test.describe("assertPublicUrl", () => {
  test("rejects non-http schemes", async () => {
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow();
    await expect(assertPublicUrl("ftp://example.org/x.pdf")).rejects.toThrow();
  });
  test("rejects literal private hosts", async () => {
    await expect(assertPublicUrl("http://127.0.0.1/x.pdf")).rejects.toThrow();
    await expect(assertPublicUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow();
    await expect(assertPublicUrl("http://localhost:3000/")).rejects.toThrow();
  });
  test("accepts a public https URL", async () => {
    await expect(assertPublicUrl("https://arxiv.org/pdf/1706.03762")).resolves.toBeTruthy();
  });
});
