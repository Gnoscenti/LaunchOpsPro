/**
 * Configuration — Visual credential vault and system settings
 * Uses tRPC for persistent credential management via the credential router.
 * Available procedures: list, save (upsert), delete
 * List returns: { id, keyName, service, description, lastUsedAt, createdAt, updatedAt }
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Key,
  Shield,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Loader2,
  LogIn,
  Settings,
  Lock,
  RefreshCw,
  Save,
} from "lucide-react";

/** Infer credential type from keyName for display badge */
function inferType(keyName: string): string {
  const k = keyName.toLowerCase();
  if (k.includes("api_key") || k.includes("apikey")) return "api_key";
  if (k.includes("oauth") || k.includes("token")) return "oauth_token";
  if (k.includes("ssh")) return "ssh_key";
  if (k.includes("password") || k.includes("pass")) return "password";
  if (k.includes("cert")) return "certificate";
  if (k.includes("path") || k.includes("file")) return "file_path";
  return "env_var";
}

const typeLabels: Record<string, string> = {
  api_key: "API Key",
  oauth_token: "OAuth Token",
  ssh_key: "SSH Key",
  password: "Password",
  file_path: "File Path",
  env_var: "Env Variable",
  certificate: "Certificate",
};

const typeColors: Record<string, string> = {
  api_key: "bg-blue-500/20 text-blue-400",
  oauth_token: "bg-purple-500/20 text-purple-400",
  ssh_key: "bg-green-500/20 text-green-400",
  password: "bg-red-500/20 text-red-400",
  file_path: "bg-amber-500/20 text-amber-400",
  env_var: "bg-cyan-500/20 text-cyan-400",
  certificate: "bg-pink-500/20 text-pink-400",
};

export default function Configuration() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();

  const [showSecrets, setShowSecrets] = useState<Record<number, boolean>>({});
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCred, setNewCred] = useState({
    keyName: "",
    service: "",
    description: "",
    value: "",
  });

  // ── Queries ──────────────────────────────────────────────
  const credentials = trpc.credential.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // ── Mutations (save = upsert, delete) ────────────────────
  const saveCred = trpc.credential.save.useMutation({
    onSuccess: () => {
      utils.credential.list.invalidate();
      setShowAddDialog(false);
      setNewCred({ keyName: "", service: "", description: "", value: "" });
      toast.success("Credential saved to vault");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteCred = trpc.credential.delete.useMutation({
    onSuccess: () => {
      utils.credential.list.invalidate();
      toast.success("Credential removed");
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleSecret = (id: number) => {
    setShowSecrets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  /* ── Auth gate ─────────────────────────────────────────── */

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[oklch(0.75_0.15_85)]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <Settings className="w-16 h-16 text-[oklch(0.75_0.15_85)] opacity-60" />
        <h2 className="text-2xl font-bold font-[Sora]">Configuration</h2>
        <p className="text-muted-foreground max-w-md text-center">
          Sign in to manage your credential vault and system settings.
        </p>
        <a href={getLoginUrl()}>
          <Button className="bg-[oklch(0.75_0.15_85)] text-black hover:bg-[oklch(0.80_0.15_85)]">
            <LogIn className="w-4 h-4 mr-2" /> Sign In
          </Button>
        </a>
      </div>
    );
  }

  const credList = credentials.data ?? [];

  /* ── Render ────────────────────────────────────────────── */

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-[Sora]">Configuration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Credential vault and system settings — replaces .env file editing
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="bg-[oklch(0.75_0.15_85)] text-black hover:bg-[oklch(0.80_0.15_85)]">
              <Plus className="w-4 h-4 mr-1" /> Add Credential
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-[Sora]">Add Credential</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Key Name
                </label>
                <Input
                  placeholder="e.g., OPENAI_API_KEY"
                  value={newCred.keyName}
                  onChange={(e) =>
                    setNewCred((p) => ({ ...p, keyName: e.target.value }))
                  }
                  className="bg-background border-border font-[IBM_Plex_Mono]"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Service (optional)
                </label>
                <Input
                  placeholder="e.g., OpenAI, Stripe, GitHub"
                  value={newCred.service}
                  onChange={(e) =>
                    setNewCred((p) => ({ ...p, service: e.target.value }))
                  }
                  className="bg-background border-border"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Description (optional)
                </label>
                <Input
                  placeholder="What this credential is used for"
                  value={newCred.description}
                  onChange={(e) =>
                    setNewCred((p) => ({ ...p, description: e.target.value }))
                  }
                  className="bg-background border-border"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Value
                </label>
                <Input
                  type="password"
                  placeholder="Enter credential value"
                  value={newCred.value}
                  onChange={(e) =>
                    setNewCred((p) => ({ ...p, value: e.target.value }))
                  }
                  className="bg-background border-border font-[IBM_Plex_Mono]"
                />
              </div>
              <Button
                className="w-full bg-[oklch(0.75_0.15_85)] text-black hover:bg-[oklch(0.80_0.15_85)]"
                disabled={
                  !newCred.keyName.trim() ||
                  !newCred.value.trim() ||
                  saveCred.isPending
                }
                onClick={() =>
                  saveCred.mutate({
                    keyName: newCred.keyName.trim(),
                    value: newCred.value.trim(),
                    service: newCred.service.trim() || undefined,
                    description: newCred.description.trim() || undefined,
                  })
                }
              >
                {saveCred.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                Save to Vault
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Vault Security Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-4 p-4 rounded-sm bg-[oklch(0.18_0.04_85_/_20%)] border border-[oklch(0.45_0.12_85_/_30%)]"
      >
        <Shield
          size={20}
          className="text-[oklch(0.75_0.15_85)] shrink-0 mt-0.5"
        />
        <div>
          <p className="text-sm font-semibold text-[oklch(0.75_0.15_85)] font-[Sora]">
            Encrypted Credential Vault
          </p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            All credentials are encrypted at rest. Values are never exposed in
            list queries or API responses. Agents access credentials through the
            vault at runtime — no hardcoded secrets in workflows.
          </p>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-[oklch(0.14_0.005_250)] border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Key className="w-5 h-5 text-[oklch(0.75_0.15_85)]" />
            <div>
              <p className="text-xl font-bold font-[Sora]">
                {credList.length}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Total Credentials
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[oklch(0.14_0.005_250)] border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Shield className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-xl font-bold font-[Sora]">
                {credList.length}
              </p>
              <p className="text-[10px] text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[oklch(0.14_0.005_250)] border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Lock className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-xl font-bold font-[Sora]">AES-256</p>
              <p className="text-[10px] text-muted-foreground">Encryption</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[oklch(0.14_0.005_250)] border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-purple-400" />
            <div>
              <p className="text-xl font-bold font-[Sora]">Auto</p>
              <p className="text-[10px] text-muted-foreground">Rotation</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credential List */}
      {credentials.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[oklch(0.75_0.15_85)]" />
        </div>
      ) : credList.length === 0 ? (
        <Card className="bg-[oklch(0.14_0.005_250)] border-border border-dashed">
          <CardContent className="p-12 text-center">
            <Key className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold font-[Sora] mb-2">
              No credentials yet
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Add your API keys, tokens, and secrets to the encrypted vault.
              Agents will access them at runtime.
            </p>
            <Button variant="outline" onClick={() => setShowAddDialog(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add First Credential
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <h2 className="text-[10px] font-[IBM_Plex_Mono] uppercase tracking-widest text-muted-foreground mb-2">
            Vault Entries ({credList.length})
          </h2>
          {credList.map((cred, i) => {
            const credType = inferType(cred.keyName);
            return (
              <motion.div
                key={cred.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className="bg-[oklch(0.14_0.005_250)] border-border hover:border-[oklch(0.30_0.005_250)] transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Key
                          size={14}
                          className="text-[oklch(0.75_0.15_85)]"
                        />
                        <div>
                          <p className="text-sm font-semibold font-[Sora] text-foreground">
                            {cred.keyName}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge
                              variant="secondary"
                              className={`text-[9px] ${typeColors[credType] ?? ""}`}
                            >
                              {typeLabels[credType] ?? credType}
                            </Badge>
                            {cred.service && (
                              <span className="text-[10px] text-muted-foreground">
                                {cred.service}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Values are never returned by list — show masked */}
                        <span className="text-xs font-[IBM_Plex_Mono] text-muted-foreground">
                          {showSecrets[cred.id]
                            ? "(value hidden server-side)"
                            : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => toggleSecret(cred.id)}
                        >
                          {showSecrets[cred.id] ? (
                            <EyeOff size={12} />
                          ) : (
                            <Eye size={12} />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                          onClick={() => {
                            if (
                              confirm(
                                `Delete credential "${cred.keyName}"?`
                              )
                            ) {
                              deleteCred.mutate({ id: cred.id });
                            }
                          }}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground font-[IBM_Plex_Mono]">
                      <span>
                        Created:{" "}
                        {new Date(cred.createdAt).toLocaleDateString()}
                      </span>
                      <span>
                        Updated:{" "}
                        {new Date(cred.updatedAt).toLocaleDateString()}
                      </span>
                      {cred.lastUsedAt && (
                        <span>
                          Last used:{" "}
                          {new Date(cred.lastUsedAt).toLocaleDateString()}
                        </span>
                      )}
                      {cred.description && (
                        <span className="text-muted-foreground/60 truncate max-w-[200px]">
                          {cred.description}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
