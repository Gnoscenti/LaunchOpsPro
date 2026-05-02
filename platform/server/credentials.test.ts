import { describe, it, expect } from "vitest";

describe("Credential Vault — Secret Validation", () => {
  it("STRIPE_SECRET_KEY is set and has valid format", () => {
    const key = process.env.STRIPE_SECRET_KEY;
    expect(key).toBeDefined();
    expect(key!.length).toBeGreaterThan(10);
    // Stripe keys start with sk_test_ or sk_live_ or rk_test_ or rk_live_
    expect(key).toMatch(/^(sk_test_|sk_live_|rk_test_|rk_live_)/);
  });

  it("STRIPE_SECRET_KEY can reach Stripe API", async () => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return; // skip if not set
    const res = await fetch("https://api.stripe.com/v1/balance", {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });
    // 200 = valid key, 401 = invalid key
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.object).toBe("balance");
  });

  it("GITHUB_TOKEN is set and has valid format", () => {
    const token = process.env.GITHUB_TOKEN;
    expect(token).toBeDefined();
    expect(token!.length).toBeGreaterThan(10);
  });

  it("GITHUB_TOKEN can reach GitHub API", async () => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return; // skip if not set
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "LaunchOpsPro-Platform",
      },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.login).toBeDefined();
  });
});
