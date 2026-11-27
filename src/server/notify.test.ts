import { describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({ env: {} }));
vi.mock("@/db", () => ({ db: {} }));

describe("buildMessage", () => {
  it("writes Arabic and English text with the booking number and link", async () => {
    const { buildMessage } = await import("./notify");
    const m = buildMessage({
      to: "a@b.c",
      bookingNumber: "BK-000007",
      status: "loaded",
      location: "Jebel Ali",
      trackingUrl: "https://x.test/t/abc",
    });
    expect(m.subject).toBe("BK-000007: Your shipment is loaded and on its way");
    expect(m.body).toContain("تم تحميل شحنتك");
    expect(m.body).toContain("(Jebel Ali)");
    expect(m.body).toContain("https://x.test/t/abc");
  });
});
