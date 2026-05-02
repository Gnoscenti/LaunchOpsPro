/**
 * Naming Contest — Viral Brand Name Decision Engine
 * ==================================================
 * Create shareable polls where your audience helps you pick the perfect brand name.
 * Each contest generates a unique link for social sharing.
 */
import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Trophy,
  Plus,
  Trash2,
  Share2,
  Copy,
  ExternalLink,
  Users,
  Eye,
  BarChart3,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Sparkles,
  Vote,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

interface CandidateInput {
  id: string;
  name: string;
  tagline: string;
}

export default function NamingContest() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();

  const { data: contests, isLoading } = trpc.contest.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const createContest = trpc.contest.create.useMutation({
    onSuccess: (data) => {
      toast.success("Contest created! Share the link to start collecting votes.");
      utils.contest.list.invalidate();
      setShowCreate(false);
      setNewTitle("");
      setNewDescription("");
      setCandidates([
        { id: crypto.randomUUID(), name: "", tagline: "" },
        { id: crypto.randomUUID(), name: "", tagline: "" },
      ]);
    },
    onError: (err) => toast.error(err.message),
  });

  const closeContest = trpc.contest.close.useMutation({
    onSuccess: () => {
      toast.success("Contest closed");
      utils.contest.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [candidates, setCandidates] = useState<CandidateInput[]>([
    { id: crypto.randomUUID(), name: "", tagline: "" },
    { id: crypto.randomUUID(), name: "", tagline: "" },
  ]);

  const [expandedContest, setExpandedContest] = useState<number | null>(null);

  const addCandidate = () => {
    if (candidates.length >= 10) return;
    setCandidates([...candidates, { id: crypto.randomUUID(), name: "", tagline: "" }]);
  };

  const removeCandidate = (id: string) => {
    if (candidates.length <= 2) return;
    setCandidates(candidates.filter((c) => c.id !== id));
  };

  const updateCandidate = (id: string, field: "name" | "tagline", value: string) => {
    setCandidates(candidates.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const handleCreate = () => {
    const validCandidates = candidates.filter((c) => c.name.trim());
    if (validCandidates.length < 2) {
      toast.error("Need at least 2 candidates with names");
      return;
    }
    createContest.mutate({
      title: newTitle,
      description: newDescription || undefined,
      candidates: validCandidates.map((c) => ({
        id: c.id,
        name: c.name.trim(),
        tagline: c.tagline.trim() || undefined,
      })),
    });
  };

  const getShareUrl = (shareId: string) => {
    return `${window.location.origin}/vote/${shareId}`;
  };

  const copyShareLink = (shareId: string) => {
    navigator.clipboard.writeText(getShareUrl(shareId));
    toast.success("Share link copied to clipboard!");
  };

  // Unauthenticated state
  if (!isAuthenticated && !authLoading) {
    return (
      <div className="space-y-8 pt-12">
        <div className="text-center max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Trophy className="w-5 h-5 text-[oklch(0.75_0.15_85)]" />
            <span className="text-xs font-[IBM_Plex_Mono] tracking-widest uppercase text-[oklch(0.75_0.15_85)]">
              Naming Contest
            </span>
          </div>
          <h1 className="text-3xl font-bold font-[Sora] tracking-tight mb-4">
            Let Your Audience Choose Your Brand Name
          </h1>
          <p className="text-muted-foreground text-lg mb-8">
            Create shareable polls, collect votes from your network, and make data-driven naming decisions.
          </p>
          <a href={getLoginUrl()}>
            <Button
              size="lg"
              className="font-[Sora]"
              style={{ backgroundColor: "oklch(0.75 0.15 85)", color: "oklch(0.12 0.005 250)" }}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Create Your First Contest
            </Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-5 h-5 text-[oklch(0.75_0.15_85)]" />
            <span className="text-xs font-[IBM_Plex_Mono] tracking-widest uppercase text-[oklch(0.75_0.15_85)]">
              Naming Contest
            </span>
          </div>
          <h1 className="text-2xl font-bold font-[Sora] tracking-tight">
            Brand Name Polls
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create shareable polls and let your audience help you decide.
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(!showCreate)}
          className="font-[Sora]"
          style={
            showCreate
              ? {}
              : { backgroundColor: "oklch(0.75 0.15 85)", color: "oklch(0.12 0.005 250)" }
          }
          variant={showCreate ? "outline" : "default"}
        >
          {showCreate ? (
            <>
              <XCircle className="w-4 h-4 mr-1.5" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-1.5" />
              New Contest
            </>
          )}
        </Button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <Card className="border-[oklch(0.75_0.15_85_/_30%)]">
          <CardHeader>
            <CardTitle className="text-lg font-[Sora]">Create Naming Contest</CardTitle>
            <CardDescription>
              Add your brand name candidates and share the link with your network.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Contest Title</label>
              <Input
                placeholder="e.g., Help me name my new startup!"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="font-[Sora]"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description (optional)</label>
              <Textarea
                placeholder="Give voters some context about your brand, target audience, or what you're building..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium">Candidates ({candidates.length}/10)</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addCandidate}
                  disabled={candidates.length >= 10}
                  className="text-xs h-7"
                  style={{ color: "oklch(0.75 0.15 85)" }}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>

              <div className="space-y-3">
                {candidates.map((c, i) => (
                  <div key={c.id} className="flex gap-2 items-start">
                    <span className="text-xs text-muted-foreground font-[IBM_Plex_Mono] mt-2.5 w-6 shrink-0">
                      {i + 1}.
                    </span>
                    <div className="flex-1 space-y-1.5">
                      <Input
                        placeholder="Brand name"
                        value={c.name}
                        onChange={(e) => updateCandidate(c.id, "name", e.target.value)}
                        className="font-[Sora]"
                      />
                      <Input
                        placeholder="Tagline (optional)"
                        value={c.tagline}
                        onChange={(e) => updateCandidate(c.id, "tagline", e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCandidate(c.id)}
                      disabled={candidates.length <= 2}
                      className="mt-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={handleCreate}
              disabled={!newTitle.trim() || candidates.filter((c) => c.name.trim()).length < 2 || createContest.isPending}
              className="w-full font-[Sora]"
              style={{ backgroundColor: "oklch(0.75 0.15 85)", color: "oklch(0.12 0.005 250)" }}
            >
              {createContest.isPending ? "Creating..." : "Create Contest & Get Share Link"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Contest List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading contests...</div>
      ) : !contests?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-bold font-[Sora] mb-2">No Contests Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first naming contest to start collecting votes from your network.
            </p>
            <Button
              onClick={() => setShowCreate(true)}
              className="font-[Sora]"
              style={{ backgroundColor: "oklch(0.75 0.15 85)", color: "oklch(0.12 0.005 250)" }}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create Contest
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {contests.map((contest: any) => (
            <ContestCard
              key={contest.id}
              contest={contest}
              expanded={expandedContest === contest.id}
              onToggle={() => setExpandedContest(expandedContest === contest.id ? null : contest.id)}
              onCopyLink={() => copyShareLink(contest.shareId)}
              onClose={() => closeContest.mutate({ id: contest.id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ContestCard({
  contest,
  expanded,
  onToggle,
  onCopyLink,
  onClose,
}: {
  contest: any;
  expanded: boolean;
  onToggle: () => void;
  onCopyLink: () => void;
  onClose: () => void;
}) {
  const { data: results } = trpc.contest.results.useQuery(
    { id: contest.id },
    { enabled: expanded }
  );

  const candidates = (contest.candidates as any[]) ?? [];
  const totalVotes = contest.totalVotes ?? 0;

  return (
    <Card className={`transition-all duration-200 ${expanded ? "border-[oklch(0.75_0.15_85_/_30%)]" : ""}`}>
      <CardContent className="py-4">
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={onToggle}>
            <div className="w-10 h-10 rounded-lg bg-[oklch(0.75_0.15_85_/_10%)] flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-[oklch(0.75_0.15_85)]" />
            </div>
            <div>
              <h3 className="font-semibold font-[Sora] text-sm">{contest.title}</h3>
              <div className="flex items-center gap-3 mt-0.5">
                <Badge
                  variant="outline"
                  className="text-[10px]"
                  style={{
                    borderColor: contest.status === "active" ? "oklch(0.72 0.19 149)" : "oklch(0.5 0.05 260)",
                    color: contest.status === "active" ? "oklch(0.72 0.19 149)" : "oklch(0.5 0.05 260)",
                  }}
                >
                  {contest.status}
                </Badge>
                <span className="text-[10px] text-muted-foreground font-[IBM_Plex_Mono] flex items-center gap-1">
                  <Users className="w-3 h-3" /> {totalVotes} votes
                </span>
                <span className="text-[10px] text-muted-foreground font-[IBM_Plex_Mono] flex items-center gap-1">
                  <Eye className="w-3 h-3" /> {contest.totalViews ?? 0} views
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onCopyLink} className="text-xs h-8">
              <Copy className="w-3.5 h-3.5 mr-1" />
              Copy Link
            </Button>
            <a href={`/vote/${contest.shareId}`} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="text-xs h-8">
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
          </div>
        </div>

        {/* Expanded Results */}
        {expanded && results && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="space-y-3">
              {candidates.map((candidate: any) => {
                const voteCount = results.results?.find((r: any) => r.candidateId === candidate.id)?.votes ?? 0;
                const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                const isLeading = voteCount > 0 && voteCount === Math.max(...(results.results?.map((r: any) => r.votes) ?? [0]));

                return (
                  <div key={candidate.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isLeading && <Trophy className="w-3.5 h-3.5 text-[oklch(0.75_0.15_85)]" />}
                        <span className={`text-sm font-[Sora] ${isLeading ? "font-bold text-[oklch(0.75_0.15_85)]" : ""}`}>
                          {candidate.name}
                        </span>
                        {candidate.tagline && (
                          <span className="text-xs text-muted-foreground">— {candidate.tagline}</span>
                        )}
                      </div>
                      <span className="text-xs font-[IBM_Plex_Mono] text-muted-foreground">
                        {voteCount} ({percentage}%)
                      </span>
                    </div>
                    <div className="h-2 bg-[oklch(0.2_0.005_250)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: isLeading ? "oklch(0.75 0.15 85)" : "oklch(0.5 0.1 250)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Comments */}
            {results.comments && results.comments.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border/50">
                <h4 className="text-xs font-[IBM_Plex_Mono] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> Recent Comments
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {results.comments.map((comment: any) => (
                    <div key={comment.id} className="text-xs">
                      <span className="font-medium">{comment.voterName || "Anonymous"}</span>
                      <span className="text-muted-foreground"> voted for </span>
                      <span className="font-[Sora] text-[oklch(0.75_0.15_85)]">
                        {candidates.find((c: any) => c.id === comment.candidateId)?.name ?? "?"}
                      </span>
                      {comment.comment && (
                        <p className="text-muted-foreground mt-0.5 ml-2 italic">"{comment.comment}"</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex gap-2">
              {contest.status === "active" && (
                <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
                  Close Contest
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
