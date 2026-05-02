/**
 * Payment History — Invoice List from Stripe
 * ============================================
 * Displays the user's payment history fetched from Stripe API.
 * Shows invoice details, status, amounts, and links to hosted invoices.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Receipt, ExternalLink, Download, CreditCard,
  Loader2, FileText, AlertCircle,
} from "lucide-react";

function formatCurrency(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  paid: { label: "Paid", className: "bg-green-500/10 text-green-400 border-green-500/30" },
  open: { label: "Open", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  draft: { label: "Draft", className: "bg-muted text-muted-foreground border-border" },
  void: { label: "Void", className: "bg-red-500/10 text-red-400 border-red-500/30" },
  uncollectible: { label: "Uncollectible", className: "bg-red-500/10 text-red-400 border-red-500/30" },
};

export default function PaymentHistory() {
  const { isAuthenticated } = useAuth();

  const { data, isLoading } = trpc.subscription.paymentHistory.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: currentSub } = trpc.subscription.current.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[oklch(0.75_0.15_85)]" />
        <span className="ml-2 text-muted-foreground">Loading payment history...</span>
      </div>
    );
  }

  const invoices = data?.invoices ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Receipt className="w-5 h-5 text-[oklch(0.75_0.15_85)]" />
          <span className="text-xs font-[IBM_Plex_Mono] tracking-widest uppercase text-[oklch(0.75_0.15_85)]">
            Billing
          </span>
        </div>
        <h1 className="text-2xl font-bold font-[Sora] tracking-tight">
          Payment History
        </h1>
        <p className="text-muted-foreground mt-1">
          View your invoices and payment records from Stripe.
        </p>
      </div>

      {/* Current Plan Summary */}
      {currentSub && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    Current Plan: <span style={{ color: currentSub.tierConfig.badgeColor }}>{currentSub.tierConfig.name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {currentSub.stripeCustomerId
                      ? `Customer: ${currentSub.stripeCustomerId.slice(0, 18)}...`
                      : "No Stripe customer linked"}
                  </p>
                </div>
              </div>
              {currentSub.stripeCustomerId && (
                <Badge variant="outline" className="text-xs">
                  Active
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices */}
      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
            <h3 className="font-[Sora] font-medium mb-1">No Invoices Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              When you subscribe to a paid plan, your invoices will appear here.
              You can view, download, and track all your payments.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-[Sora]">Invoices</CardTitle>
            <CardDescription>{invoices.length} invoice{invoices.length !== 1 ? "s" : ""} found</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-[Sora] font-medium">Invoice</th>
                    <th className="text-left py-3 px-4 font-[Sora] font-medium">Date</th>
                    <th className="text-left py-3 px-4 font-[Sora] font-medium">Status</th>
                    <th className="text-right py-3 px-4 font-[Sora] font-medium">Amount</th>
                    <th className="text-right py-3 px-4 font-[Sora] font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => {
                    const statusStyle = STATUS_STYLES[invoice.status || "draft"] ?? STATUS_STYLES.draft;
                    return (
                      <tr key={invoice.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-[IBM_Plex_Mono] text-xs">
                            {invoice.number || invoice.id.slice(0, 20)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {formatDate(invoice.created)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className={`text-xs ${statusStyle.className}`}>
                            {statusStyle.label}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-[IBM_Plex_Mono] font-medium">
                          {formatCurrency(invoice.amountPaid || invoice.amountDue, invoice.currency)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {invoice.hostedInvoiceUrl && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => window.open(invoice.hostedInvoiceUrl!, "_blank")}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {invoice.invoicePdf && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => window.open(invoice.invoicePdf!, "_blank")}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="border-dashed border-muted-foreground/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              All payment data is fetched directly from Stripe. For billing questions or disputes,
              contact support or manage your subscription from the Pricing page.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
