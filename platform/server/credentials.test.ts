import { describe, expect, it } from "vitest";

const isStripeSecret = (value: string): boolean =>
  /^(sk_test_|sk_live_|rk_test_|rk_live_).{3,}$/.test(value);

const isGitHubToken = (value: string): boolean =>
  /^(gh[pousr]_|github_pat_).{3,}$/.test(value);

describe("Credential configuration", () => {
  it("recognizes supported Stripe secret formats", () => {
    expect(isStripeSecret("sk_test_example_value")).toBe(true);
    expect(isStripeSecret("rk_live_example_value")).toBe(true);
    expect(isStripeSecret("pk_test_public_key")).toBe(false);
    expect(isStripeSecret("")).toBe(false);
  });

  it("recognizes supported GitHub token formats", () => {
    expect(isGitHubToken("ghp_example_value")).toBe(true);
    expect(isGitHubToken("github_pat_example_value")).toBe(true);
    expect(isGitHubToken("plain-text-token")).toBe(false);
    expect(isGitHubToken("")).toBe(false);
  });
});

const runLiveCredentialTests = process.env.RUN_LIVE_CREDENTIAL_TESTS === "true";

describe.skipIf(!runLiveCredentialTests)("Live credential integration", () => {
  it("reaches Stripe with an explicitly supplied secret", async () => {
    const key = process.env.STRIPE_SECRET_KEY;
    expect(key, "STRIPE_SECRET_KEY is required when live checks are enabled").toBeDefined();
    expect(isStripeSecret(key!)).toBe(true);

    const response = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(response.status).toBe(200);
  });

  it("reaches GitHub with an explicitly supplied token", async () => {
    const token = process.env.GITHUB_TOKEN;
    expect(token, "GITHUB_TOKEN is required when live checks are enabled").toBeDefined();
    expect(isGitHubToken(token!)).toBe(true);

    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "LaunchOpsPro-Platform",
      },
    });
    expect(response.status).toBe(200);
  });
});
