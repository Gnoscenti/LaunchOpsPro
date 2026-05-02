/**
 * Pricing Page — Revenue Tier Comparison + Stripe Checkout
 * =========================================================
 * Shows all 4 tiers with live Stripe checkout integration.
 * Handles success/cancel redirects from Stripe and offers
 * Customer Portal for existing subscribers.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Compass, Rocket, Shield, Building2, Check, X, Zap,
  ArrowRight, Crown, Loader2, CreditCard, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState, useMemo } from "react";
import { getLoginUrl } from "@/const";

const TIER_ICONS: Record<string, React.ReactNode> = {
  Compass: <Compass className="w-6 h-6" />,
  Rocket: <Rocket className="w-6 h-6" />,
  Shield: <Shield className="w-6 h-6" />,
  Building2: <Building2 className="w-6 h-6" />,
};

export default function Pricing() {
  const { user, isAuthenticated } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const { data: tiers } = trpc.subscription.tiers.useQuery();
  const { data: currentSub, refetch: refetchSub } = trpc.subscription.current.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const createCheckout = trpc.subscription.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        toast.info("Redirecting to Stripe checkout...");
        window.open(data.checkoutUrl, "_blank");
      }
      setCheckoutLoading(null);
    },
    onError: (error) => {
      toast.error(`Checkout failed: ${error.message}`);
      setCheckoutLoading(null);
    },
  });

  const createPortal = trpc.subscription.createPortalSession.useMutation({
    onSuccess: (data) => {
      if (data.portalUrl) {
        toast.info("Opening subscription management...");
        window.open(data.portalUrl, "_blank");
      }
      setPortalLoading(false);
    },
    onError: (error) => {
      toast.error(`Portal failed: ${error.message}`);
      setPortalLoading(false);
    },
  });

  // Handle success/cancel redirects from Stripe
  const [urlParams] = useState(() => new URLSearchParams(window.location.search));

  useEffect(() => {
    if (urlParams.get("success") === "true") {
      toast.success("Subscription activated! Your account has been upgraded.", {
        duration: 6000,
      });
      refetchSub();
      // Clean URL
      window.history.replaceState({}, "", "/pricing");
    } else if (urlParams.get("canceled") === "true") {
      toast.info("Checkout canceled. No charges were made.");
      window.history.replaceState({}, "", "/pricing");
    }
  }, [urlParams, refetchSub]);

  const currentTier = currentSub?.tier ?? "explorer";
  const tierOrder = useMemo(() => ["explorer", "founder", "governance", "enterprise"], []);
  const currentTierIndex = tierOrder.indexOf(currentTier);
  const isPaidSubscriber = currentTier !== "explorer" && currentSub?.stripeCustomerId;

  const handleUpgrade = (tierId: string) => {
    if (!isAuthenticated) {
      toast.info("Sign in to subscribe to a plan.");
      window.location.href = getLoginUrl();
      return;
    }

    if (tierId === "enterprise") {
      toast.info("Contact us at enterprise@launchopspro.com for custom pricing and onboarding.");
      return;
    }

    if (tierId === "explorer") return;

    setCheckoutLoading(tierId);
    createCheckout.mutate({
      tierId: tierId as "founder" | "governance" | "enterprise",
    });
  };

  const handleManageSubscription = () => {
    setPortalLoading(true);
    createPortal.mutate();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Crown className="w-5 h-5 text-[oklch(0.75_0.15_85)]" />
          <span className="text-xs font-[IBM_Plex_Mono] tracking-widest uppercase text-[oklch(0.75_0.15_85)]">
            Revenue Architecture
          </span>
        </div>
        <h1 className="text-3xl font-bold font-[Sora] tracking-tight mb-3">
          Choose Your Launch Tier
        </h1>
        <p className="text-muted-foreground text-lg">
          From free exploration to enterprise governance — scale your AI-powered business launch with the right level of automation, agents, and trust infrastructure.
        </p>
        {isAuthenticated && currentSub && (
          <div className="mt-4 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-sm px-3 py-1"
                style={{ borderColor: currentSub.tierConfig.badgeColor, color: currentSub.tierConfig.badgeColor }}
              >
                {TIER_ICONS[currentSub.tierConfig.icon]}
                <span className="ml-1.5">{currentSub.tierConfig.name}</span>
              </Badge>
              {!currentSub.quota.unlimited && (
                <span className="text-sm text-muted-foreground">
                  {currentSub.quota.used}/{currentSub.quota.limit} reports used
                </span>
              )}
            </div>
            {/* Manage Subscription Button for paid users */}
            {isPaidSubscriber && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="gap-1.5"
              >
                {portalLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CreditCard className="w-3.5 h-3.5" />
                )}
                Manage Subscription
                <ExternalLink className="w-3 h-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {tiers?.map((tier) => {
          const isCurrentTier = tier.id === currentTier;
          const tierIndex = tierOrder.indexOf(tier.id);
          const isUpgrade = tierIndex > currentTierIndex;
          const isDowngrade = tierIndex < currentTierIndex;
          const isLoading = checkoutLoading === tier.id;

          return (
            <Card
              key={tier.id}
              className={`relative overflow-hidden transition-all duration-300 ${
                isCurrentTier
                  ? "ring-2 shadow-lg"
                  : "hover:shadow-md"
              } ${tier.id === "governance" ? "md:scale-[1.02]" : ""}`}
              style={{
                borderColor: isCurrentTier ? tier.badgeColor : undefined,
                ...(isCurrentTier ? { boxShadow: `0 0 20px ${tier.badgeColor}33` } : {}),
              }}
            >
              {/* Popular badge for Governance */}
              {tier.id === "governance" && (
                <div
                  className="absolute top-0 right-0 px-3 py-1 text-xs font-bold font-[IBM_Plex_Mono] tracking-wider text-white"
                  style={{ backgroundColor: tier.badgeColor }}
                >
                  MOST POPULAR
                </div>
              )}

              {/* Current tier indicator */}
              {isCurrentTier && (
                <div
                  className="absolute top-0 left-0 px-3 py-1 text-xs font-bold font-[IBM_Plex_Mono] tracking-wider text-white"
                  style={{ backgroundColor: tier.badgeColor }}
                >
                  CURRENT PLAN
                </div>
              )}

              <CardHeader className="pt-8">
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${tier.badgeColor}22`, color: tier.badgeColor }}
                  >
                    {TIER_ICONS[tier.icon]}
                  </div>
                  <div>
                    <CardTitle className="text-lg font-[Sora]">{tier.name}</CardTitle>
                    <CardDescription className="text-xs">{tier.tagline}</CardDescription>
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-bold font-[Sora]" style={{ color: tier.badgeColor }}>
                    {tier.price === 0 ? "Free" : `$${tier.price}`}
                  </span>
                  {tier.price > 0 && (
                    <span className="text-sm text-muted-foreground ml-1">/month</span>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Features */}
                <ul className="space-y-2.5">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check
                        className="w-4 h-4 mt-0.5 shrink-0"
                        style={{ color: tier.badgeColor }}
                      />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="pt-4">
                  {isCurrentTier ? (
                    isPaidSubscriber ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleManageSubscription}
                        disabled={portalLoading}
                      >
                        {portalLoading ? (
                          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        ) : (
                          <CreditCard className="w-4 h-4 mr-1.5" />
                        )}
                        Manage Plan
                      </Button>
                    ) : (
                      <Button variant="outline" className="w-full" disabled>
                        Current Plan
                      </Button>
                    )
                  ) : isUpgrade ? (
                    <Button
                      className="w-full font-[Sora] font-medium"
                      style={{
                        backgroundColor: tier.badgeColor,
                        color: "white",
                      }}
                      onClick={() => handleUpgrade(tier.id)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      ) : (
                        <Zap className="w-4 h-4 mr-1.5" />
                      )}
                      {isLoading ? "Creating checkout..." : `Upgrade to ${tier.name}`}
                      {!isLoading && <ArrowRight className="w-4 h-4 ml-1.5" />}
                    </Button>
                  ) : isDowngrade ? (
                    <Button variant="ghost" className="w-full text-muted-foreground" disabled>
                      Included in your plan
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleUpgrade(tier.id)}
                    >
                      Get Started
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Feature Comparison Table */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="font-[Sora]">Feature Comparison</CardTitle>
          <CardDescription>Detailed breakdown of what each tier includes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-[Sora] font-medium">Feature</th>
                  <th className="text-center py-3 px-4 font-[Sora] font-medium" style={{ color: "oklch(0.65 0.15 160)" }}>Explorer</th>
                  <th className="text-center py-3 px-4 font-[Sora] font-medium" style={{ color: "oklch(0.75 0.15 85)" }}>Founder</th>
                  <th className="text-center py-3 px-4 font-[Sora] font-medium" style={{ color: "oklch(0.65 0.18 280)" }}>Governance</th>
                  <th className="text-center py-3 px-4 font-[Sora] font-medium" style={{ color: "oklch(0.55 0.2 30)" }}>Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: "Monthly Reports", values: ["3", "Unlimited", "Unlimited", "Unlimited"] },
                  { feature: "Agent Access", values: ["5 basic", "All 25", "All 25", "All + Custom"] },
                  { feature: "Brand Architect", values: [true, true, true, true] },
                  { feature: "20-Step Pipeline", values: [false, true, true, true] },
                  { feature: "SSE Streaming", values: [false, true, true, true] },
                  { feature: "Artifact Storage", values: [false, true, true, true] },
                  { feature: "ProofGuard Governance", values: [false, false, true, true] },
                  { feature: "HITL Approval Gates", values: [false, false, true, true] },
                  { feature: "Compliance Export", values: [false, false, true, true] },
                  { feature: "Attestation Audit Trail", values: [false, false, true, true] },
                  { feature: "White-Label", values: [false, false, false, true] },
                  { feature: "Custom Agents", values: [false, false, false, true] },
                  { feature: "SLA Guarantee", values: [false, false, false, true] },
                  { feature: "Concurrent Executions", values: ["1", "3", "5", "Unlimited"] },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-4 text-muted-foreground">{row.feature}</td>
                    {row.values.map((val, j) => (
                      <td key={j} className="text-center py-2.5 px-4">
                        {typeof val === "boolean" ? (
                          val ? (
                            <Check className="w-4 h-4 mx-auto text-green-500" />
                          ) : (
                            <X className="w-4 h-4 mx-auto text-muted-foreground/30" />
                          )
                        ) : (
                          <span className="text-foreground font-medium">{val}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Test Card Info */}
      <Card className="border-dashed border-[oklch(0.75_0.15_85_/_40%)]">
        <CardContent className="py-6">
          <div className="flex items-start gap-3">
            <CreditCard className="w-5 h-5 text-[oklch(0.75_0.15_85)] shrink-0 mt-0.5" />
            <div>
              <h4 className="font-[Sora] font-medium text-sm mb-1">Test Mode Active</h4>
              <p className="text-xs text-muted-foreground">
                Payments are in test mode. Use card number <code className="bg-muted px-1.5 py-0.5 rounded text-[oklch(0.75_0.15_85)]">4242 4242 4242 4242</code> with any future expiry date and any CVC to test the checkout flow.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enterprise CTA */}
      <Card className="border-[oklch(0.55_0.2_30)] bg-[oklch(0.55_0.2_30_/_5%)]">
        <CardContent className="py-8 text-center">
          <Building2 className="w-10 h-10 mx-auto mb-4 text-[oklch(0.55_0.2_30)]" />
          <h3 className="text-xl font-bold font-[Sora] mb-2">Need Enterprise Scale?</h3>
          <p className="text-muted-foreground mb-4 max-w-lg mx-auto">
            White-label deployment, custom agent development, dedicated support, and 99.9% SLA.
            Let us build the governance infrastructure your organization needs.
          </p>
          <Button
            size="lg"
            className="font-[Sora]"
            style={{ backgroundColor: "oklch(0.55 0.2 30)", color: "white" }}
            onClick={() => handleUpgrade("enterprise")}
          >
            Contact Enterprise Sales
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
