/**
 * VotePage — Public Voting Interface
 * ====================================
 * Accessible without authentication via /vote/:shareId
 * Voters can cast one vote per contest (fingerprint-based dedup).
 * Designed to be shareable and visually engaging for social media.
 */
import { useState, useMemo } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  Vote,
  CheckCircle2,
  MessageSquare,
  Users,
  Eye,
  Zap,
  Share2,
  Copy,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

export default function VotePage() {
  const [, params] = useRoute("/vote/:shareId");
  const shareId = params?.shareId ?? "";

  const { data: contest, isLoading, error } = trpc.contest.getByShareId.useQuery(
    { shareId },
    { enabled: !!shareId }
  );

  const voteMutation = trpc.contest.vote.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setHasVoted(true);
        setVoteResults(data.results ?? []);
        toast.success("Vote recorded! Thanks for helping decide.");
      } else {
        setHasVoted(true);
        toast.info("You've already voted in this contest.");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [voterName, setVoterName] = useState("");
  const [comment, setComment] = useState("");
  const [hasVoted, setHasVoted] = useState(false);
  const [voteResults, setVoteResults] = useState<any[]>([]);

  // Generate a fingerprint from available browser data
  const fingerprint = useMemo(() => {
    const raw = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      new Date().getTimezoneOffset(),
    ].join("|");
    // Simple hash
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash.toString(36);
  }, []);

  const handleVote = () => {
    if (!selectedCandidate) {
      toast.error("Please select a candidate first");
      return;
    }
    voteMutation.mutate({
      shareId,
      candidateId: selectedCandidate,
      voterName: voterName.trim() || undefined,
      comment: comment.trim() || undefined,
      fingerprint,
    });
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied! Share it with others.");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-[oklch(0.75_0.15_85)] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground font-[IBM_Plex_Mono] text-sm">Loading contest...</p>
        </div>
      </div>
    );
  }

  if (error || !contest) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="py-12 text-center">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <h2 className="text-xl font-bold font-[Sora] mb-2">Contest Not Found</h2>
            <p className="text-sm text-muted-foreground">
              This contest may have been removed or the link is invalid.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const candidates = (contest.candidates as any[]) ?? [];
  const totalVotes = contest.totalVotes ?? 0;
  const displayResults = hasVoted ? voteResults : (contest.results ?? []);
  const isClosed = contest.status === "closed";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-[oklch(0.13_0.005_250)]">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded bg-[oklch(0.75_0.15_85)] flex items-center justify-center">
              <Zap size={16} className="text-[oklch(0.12_0.005_250)]" />
            </div>
            <span className="text-xs font-[IBM_Plex_Mono] tracking-widest uppercase text-[oklch(0.75_0.15_85)]">
              Brand Name Poll
            </span>
          </div>
          <h1 className="text-2xl font-bold font-[Sora] tracking-tight">{contest.title}</h1>
          {contest.description && (
            <p className="text-muted-foreground mt-2">{contest.description}</p>
          )}
          <div className="flex items-center gap-4 mt-3">
            <span className="text-xs text-muted-foreground font-[IBM_Plex_Mono] flex items-center gap-1">
              <Users className="w-3 h-3" /> {totalVotes + (hasVoted ? 1 : 0)} votes
            </span>
            <span className="text-xs text-muted-foreground font-[IBM_Plex_Mono] flex items-center gap-1">
              <Eye className="w-3 h-3" /> {contest.totalViews ?? 0} views
            </span>
            {isClosed && (
              <Badge variant="outline" className="text-[10px]" style={{ borderColor: "oklch(0.65 0.2 30)", color: "oklch(0.65 0.2 30)" }}>
                Closed
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Voting Area */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Candidates */}
        <div className="space-y-3 mb-6">
          {candidates.map((candidate: any) => {
            const isSelected = selectedCandidate === candidate.id;
            const voteCount = displayResults.find((r: any) => r.candidateId === candidate.id)?.votes ?? 0;
            const adjustedTotal = totalVotes + (hasVoted ? 1 : 0);
            const percentage = adjustedTotal > 0 ? Math.round((voteCount / adjustedTotal) * 100) : 0;
            const isLeading = voteCount > 0 && voteCount === Math.max(...displayResults.map((r: any) => r.votes ?? 0));

            return (
              <Card
                key={candidate.id}
                className={`transition-all duration-200 cursor-pointer ${
                  isClosed || hasVoted ? "cursor-default" : "hover:shadow-md"
                } ${isSelected ? "border-[oklch(0.75_0.15_85)] bg-[oklch(0.75_0.15_85_/_5%)]" : ""}`}
                onClick={() => !isClosed && !hasVoted && setSelectedCandidate(candidate.id)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Selection indicator */}
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                          isSelected
                            ? "border-[oklch(0.75_0.15_85)] bg-[oklch(0.75_0.15_85)]"
                            : hasVoted && isLeading
                            ? "border-[oklch(0.75_0.15_85)]"
                            : "border-border"
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-[oklch(0.12_0.005_250)]" />}
                        {!isSelected && hasVoted && isLeading && (
                          <Trophy className="w-3 h-3 text-[oklch(0.75_0.15_85)]" />
                        )}
                      </div>

                      <div>
                        <span className={`font-[Sora] font-semibold ${isLeading && hasVoted ? "text-[oklch(0.75_0.15_85)]" : ""}`}>
                          {candidate.name}
                        </span>
                        {candidate.tagline && (
                          <p className="text-xs text-muted-foreground mt-0.5">{candidate.tagline}</p>
                        )}
                      </div>
                    </div>

                    {(hasVoted || isClosed) && (
                      <span className="text-sm font-[IBM_Plex_Mono] text-muted-foreground">
                        {voteCount} ({percentage}%)
                      </span>
                    )}
                  </div>

                  {/* Progress bar (shown after voting or when closed) */}
                  {(hasVoted || isClosed) && (
                    <div className="mt-2 h-1.5 bg-[oklch(0.2_0.005_250)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: isLeading ? "oklch(0.75 0.15 85)" : "oklch(0.4 0.05 250)",
                        }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Vote Form (before voting) */}
        {!hasVoted && !isClosed && (
          <Card className="border-[oklch(0.75_0.15_85_/_20%)]">
            <CardContent className="py-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Your Name (optional)</label>
                  <Input
                    placeholder="Anonymous"
                    value={voterName}
                    onChange={(e) => setVoterName(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Comment (optional)</label>
                  <Input
                    placeholder="Why this name?"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
              <Button
                onClick={handleVote}
                disabled={!selectedCandidate || voteMutation.isPending}
                className="w-full font-[Sora]"
                style={{ backgroundColor: "oklch(0.75 0.15 85)", color: "oklch(0.12 0.005 250)" }}
              >
                {voteMutation.isPending ? "Submitting..." : (
                  <>
                    <Vote className="w-4 h-4 mr-1.5" />
                    Cast Your Vote
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Post-vote share CTA */}
        {hasVoted && (
          <Card className="border-[oklch(0.72_0.19_149_/_30%)] bg-[oklch(0.72_0.19_149_/_5%)]">
            <CardContent className="py-5 text-center">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: "oklch(0.72 0.19 149)" }} />
              <h3 className="font-bold font-[Sora] mb-1">Vote Recorded!</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Help this founder make the right choice — share this poll with others.
              </p>
              <Button
                variant="outline"
                onClick={copyShareLink}
                className="font-[Sora]"
              >
                <Copy className="w-4 h-4 mr-1.5" />
                Copy Share Link
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Comments section */}
        {contest.comments && contest.comments.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-[IBM_Plex_Mono] uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" /> Community Feedback
            </h3>
            <div className="space-y-2">
              {contest.comments.map((c: any) => (
                <div key={c.id} className="flex gap-2 text-sm">
                  <div className="w-6 h-6 rounded-full bg-[oklch(0.25_0.005_250)] flex items-center justify-center shrink-0 text-[10px] font-bold">
                    {(c.voterName || "A")[0].toUpperCase()}
                  </div>
                  <div>
                    <span className="font-medium text-xs">{c.voterName || "Anonymous"}</span>
                    <span className="text-xs text-muted-foreground"> voted for </span>
                    <span className="text-xs font-[Sora] text-[oklch(0.75_0.15_85)]">
                      {candidates.find((cand: any) => cand.id === c.candidateId)?.name ?? "?"}
                    </span>
                    {c.comment && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic">"{c.comment}"</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-xs text-muted-foreground font-[IBM_Plex_Mono]">
            Powered by Atlas Orchestrator — AI-powered business launch platform
          </p>
          <a href="/" className="text-xs text-[oklch(0.75_0.15_85)] hover:underline mt-1 inline-block">
            Launch your own business <ArrowRight className="w-3 h-3 inline" />
          </a>
        </div>
      </div>
    </div>
  );
}
