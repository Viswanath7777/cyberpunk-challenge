import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { motion } from "framer-motion";
import { Trophy, Zap, Target, Crown, LogOut, Settings, Coins, Plus } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const character = useQuery(api.characters.getCharacter);
  const challenges = useQuery(api.challenges.getActiveChallenges) as any[] | undefined;
  // Add: my created challenges & create challenge mutation
  const myChallenges = useQuery(api.challenges.listMyChallenges) as any[] | undefined;
  const createChallengeMutation = useMutation(api.challenges.createChallenge);

  // Add missing submitProof mutation
  const submitProof = useMutation(api.challenges.submitProof);

  // Betting queries/mutations
  const openEvents = useQuery(api.bets.listOpenEvents) as any[] | undefined;
  const myBets = useQuery(api.bets.getMyBets) as any[] | undefined;

  // Add: counts of bets per event
  const betCounts = useQuery(api.bets.countBetsForEvents, {
    eventIds: (openEvents || []).map((e: any) => e._id),
  }) as Record<string, number> | undefined;

  // Add: creator management hooks
  const myCreatedEvents = useQuery(api.bets.listMyEvents) as any[] | undefined;
  const closeBetEvent = useMutation(api.bets.closeEvent);
  const resolveBetEvent = useMutation(api.bets.resolveEvent);

  const placeBet = useMutation(api.bets.placeBet);
  const createBetEvent = useMutation(api.bets.createEvent);
  const cancelBet = useMutation(api.bets.cancelBet);

  // Leaderboard data (ranked by permanent credits)
  const leaderboard = useQuery(api.characters.getLeaderboard) as any[] | undefined;

  const [selectedChallenge, setSelectedChallenge] = useState<any>(null);
  const [proofText, setProofText] = useState("");
  const [proofImageUrl, setProofImageUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Betting state
  const [betSelections, setBetSelections] = useState<Record<string, { option: string; amount: number }>>({});

  const [betEvent, setBetEvent] = useState({
    title: "",
    description: "",
    optionsText: "", // "Alice:2.5, Bob:1.8" OR "Alice, Bob" (simple)
    durationHours: 24,
  });
  const [creatingEvent, setCreatingEvent] = useState(false);

  // Add: simple builder state for non-odds input
  const [parsedNames, setParsedNames] = useState<string[]>([]);
  const [simpleMultipliers, setSimpleMultipliers] = useState<Record<string, number>>({});

  // Add: resolutions state for creator-managed events
  const [resolutions, setResolutions] = useState<Record<string, string>>({});

  // Add new queries/mutations
  const loanRequests = useQuery(api.loans.listLoanRequests) as any[] | undefined;
  const myLoanRequests = useQuery(api.loans.myLoanRequests) as any[] | undefined;
  const createLoanRequest = useMutation(api.loans.createLoanRequest);
  const fundLoan = useMutation(api.loans.fundLoan);
  const cancelLoanRequest = useMutation(api.loans.cancelLoanRequest);

  // Add local state for loan amount input
  const [loanAmount, setLoanAmount] = useState<number>(100);

  // New challenge creation state
  const [newChallenge, setNewChallenge] = useState({
    title: "",
    description: "",
    xpReward: 50,
    type: "daily" as "daily" | "weekly" | "one-time",
    durationHours: 24 as number | undefined,
  });
  const [creatingChallenge, setCreatingChallenge] = useState(false);

  // Creator submissions view state
  const [selectedChallengeForSubs, setSelectedChallengeForSubs] = useState<any>(null);
  const submissionsForSelected = useQuery(
    api.challenges.getSubmissionsForChallenge,
    selectedChallengeForSubs ? ({ challengeId: selectedChallengeForSubs } as any) : undefined
  ) as any[] | undefined;

  // Helper to evenly distribute percentage
  const distributeEvenly = (names: string[]) => {
    if (names.length === 0) return {};
    const base = Math.floor(100 / names.length);
    const remainder = 100 - base * names.length;
    const result: Record<string, number> = {};
    names.forEach((n, i) => {
      result[n] = base + (i < remainder ? 1 : 0);
    });
    return result;
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleSubmitProof = async () => {
    if (!selectedChallenge || (!proofText && !proofImageUrl)) {
      toast.error("Please provide proof text or image URL");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitProof({
        challengeId: selectedChallenge._id,
        proofText: proofText || undefined,
        proofImageUrl: proofImageUrl || undefined,
      });
      
      toast.success("Proof submitted! Waiting for admin approval.");
      setSelectedChallenge(null);
      setProofText("");
      setProofImageUrl("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit proof");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePlaceBet = async (event: any) => {
    const sel = betSelections[event._id];
    if (!sel || !sel.option || !sel.amount || sel.amount <= 0) {
      toast.error("Select an option and enter a valid amount");
      return;
    }
    try {
      await placeBet({
        eventId: event._id,
        option: sel.option,
        amount: sel.amount,
      } as any);
      toast.success("Bet placed!");
      setBetSelections((prev) => ({ ...prev, [event._id]: { option: "", amount: 0 } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to place bet");
    }
  };

  const handleCreateBetEvent = async () => {
    // If advanced format with ":" provided, keep prior behavior
    const usingAdvanced = betEvent.optionsText.includes(":");

    let options: Array<{ label: string; odds: number }> = [];

    if (usingAdvanced) {
      const raw = betEvent.optionsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      options = raw.map((entry) => {
        const [labelPart, oddsPart] = entry.split(":").map((s) => s.trim());
        const odds = Number(oddsPart);
        return { label: labelPart, odds };
      });

      if (!betEvent.title || options.length < 2) {
        toast.error("Enter a title and at least two options (e.g., Alice:2.5, Bob:1.8)");
        return;
      }
      if (options.some((o) => !o.label || !(o.odds > 0))) {
        toast.error("Each option must include a label and odds > 0 (e.g., Alice:2.5)");
        return;
      }
    } else {
      // Simple mode: use names + chances -> compute odds = 100 / chance
      const names = parsedNames;
      if (!betEvent.title || names.length < 2) {
        toast.error("Enter a title and at least two names (e.g., Alice, Bob)");
        return;
      }
      const built = names.map((name) => {
        const odds = Number(simpleMultipliers[name] ?? 2);
        return { label: name, odds };
      });
      if (built.some((o) => !(o.odds > 0))) {
        toast.error("Each option must have a valid multiplier > 0x");
        return;
      }
      options = built;
    }

    setCreatingEvent(true);
    try {
      await createBetEvent({
        title: betEvent.title,
        description: betEvent.description || undefined,
        options,
        durationHours: betEvent.durationHours,
      } as any);
      toast.success("Betting event created");
      setBetEvent({ title: "", description: "", optionsText: "", durationHours: 24 });
      setParsedNames([]);
      setSimpleMultipliers({});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create event");
    } finally {
      setCreatingEvent(false);
    }
  };

  const handleDeleteBet = async (eventId: string) => {
    try {
      await cancelBet({ eventId } as any);
      toast.success("Bet deleted and credits refunded");
      // Clear selection for this event if any
      setBetSelections((prev) => ({ ...prev, [eventId]: { option: "", amount: 0 } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete bet");
    }
  };

  const handleCloseMyEvent = async (eventId: string) => {
    try {
      await closeBetEvent({ eventId } as any);
      toast.success("Event closed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to close event");
    }
  };

  const handleResolveMyEvent = async (eventId: string) => {
    const opt = resolutions[eventId];
    if (!opt) {
      toast.error("Select the winning option");
      return;
    }
    try {
      await resolveBetEvent({ eventId: eventId as any, winningOption: opt });
      toast.success("Event resolved and payouts distributed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to resolve event");
    }
  };

  const handleCreateChallenge = async () => {
    if (!newChallenge.title.trim() || !newChallenge.description.trim()) {
      toast.error("Please fill in title and description");
      return;
    }
    setCreatingChallenge(true);
    try {
      await createChallengeMutation({
        title: newChallenge.title,
        description: newChallenge.description,
        xpReward: Number(newChallenge.xpReward) || 0,
        type: newChallenge.type,
        durationHours: newChallenge.durationHours,
      } as any);
      toast.success("Challenge created");
      setNewChallenge({ title: "", description: "", xpReward: 50, type: "daily", durationHours: 24 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create challenge");
    } finally {
      setCreatingChallenge(false);
    }
  };

  if (!character) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-cyan-400 font-mono">Loading character data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-cyan-400 font-mono">
      {/* Cyberpunk grid background */}
      <div className="fixed inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(0,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }} />
      </div>

      {/* Header */}
      <header className="relative border-b border-cyan-400/30 bg-black/80 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="text-2xl font-bold text-cyan-400 glitch-text">
              CYBER_CLASS
            </div>
            <div className="text-sm text-green-400">
              [{character.characterName}]
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Coins className="w-4 h-4 text-green-400" />
              <span className="text-green-400">{character.credits} CR</span>
            </div>
            {user?.role === "admin" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/admin")}
                className="border-pink-500 text-pink-500 hover:bg-pink-500/10"
              >
                <Settings className="w-4 h-4 mr-2" />
                Admin
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="border-red-500 text-red-500 hover:bg-red-500/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Exit
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 relative">
        <Tabs defaultValue="challenges" className="space-y-6">
          <TabsList className="bg-gray-900/50 border border-cyan-400/30">
            <TabsTrigger value="challenges" className="data-[state=active]:bg-cyan-400/20 data-[state=active]:text-cyan-400">
              <Target className="w-4 h-4 mr-2" />
              Challenges
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="data-[state=active]:bg-cyan-400/20 data-[state=active]:text-cyan-400">
              <Trophy className="w-4 h-4 mr-2" />
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="bets" className="data-[state=active]:bg-cyan-400/20 data-[state=active]:text-cyan-400">
              💱 Bets
            </TabsTrigger>
          </TabsList>

          <TabsContent value="challenges" className="space-y-6">
            {/* New Challenge Button + Dialog */}
            <div className="flex justify-end">
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-cyan-400 text-cyan-400 hover:bg-cyan-400/10"
                  >
                    + New Challenge
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-gray-900 border-cyan-400/30">
                  <DialogHeader>
                    <DialogTitle className="text-cyan-400">Create Challenge</DialogTitle>
                    <DialogDescription className="text-gray-400">
                      Set a title, description, credit reward, type, and optional duration.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="c-title" className="text-cyan-400">Title</Label>
                      <Input
                        id="c-title"
                        value={newChallenge.title}
                        onChange={(e) => setNewChallenge((p) => ({ ...p, title: e.target.value }))}
                        className="bg-gray-800 border-gray-600 text-white"
                        placeholder="e.g., Submit notes for Chapter 3"
                      />
                    </div>
                    <div>
                      <Label htmlFor="c-desc" className="text-cyan-400">Description</Label>
                      <Textarea
                        id="c-desc"
                        value={newChallenge.description}
                        onChange={(e) => setNewChallenge((p) => ({ ...p, description: e.target.value }))}
                        className="bg-gray-800 border-gray-600 text-white"
                        placeholder="What participants need to do..."
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label htmlFor="c-xp" className="text-cyan-400">Credit Reward</Label>
                        <Input
                          id="c-xp"
                          type="number"
                          value={newChallenge.xpReward}
                          onChange={(e) => setNewChallenge((p) => ({ ...p, xpReward: parseInt(e.target.value) || 0 }))}
                          className="bg-gray-800 border-gray-600 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-cyan-400">Type</Label>
                        <Select
                          value={newChallenge.type}
                          onValueChange={(v) => setNewChallenge((p) => ({ ...p, type: v as "daily" | "weekly" | "one-time" }))}
                        >
                          <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="one-time">One-time</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="c-duration" className="text-cyan-400">Duration (hours)</Label>
                        <Input
                          id="c-duration"
                          type="number"
                          value={newChallenge.durationHours ?? ""}
                          onChange={(e) =>
                            setNewChallenge((p) => ({
                              ...p,
                              durationHours: e.target.value ? parseInt(e.target.value) || undefined : undefined,
                            }))
                          }
                          className="bg-gray-800 border-gray-600 text-white"
                          placeholder="24"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleCreateChallenge}
                      disabled={creatingChallenge || !newChallenge.title.trim() || !newChallenge.description.trim()}
                      className="w-full bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
                    >
                      {creatingChallenge ? "Creating..." : "Create Challenge"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-4"
            >
              {challenges?.map((challenge) => (
                <Card key={challenge._id} className="bg-gray-900/50 border-cyan-400/30 hover:border-cyan-400/60 transition-all">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-cyan-400 text-lg">
                          {challenge.title}
                        </CardTitle>
                        <CardDescription className="text-gray-400 mt-2">
                          {challenge.description}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-1 text-green-400 text-sm">
                          <Coins className="w-4 h-4" />
                          {challenge.xpReward} CR
                        </div>
                        <div className="text-xs text-gray-500 uppercase">
                          {challenge.type}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {challenge.userSubmission ? (
                      <div className="text-sm">
                        {challenge.userSubmission.status === "pending" && (
                          <span className="text-yellow-400">⏳ Pending Review</span>
                        )}
                        {challenge.userSubmission.status === "approved" && (
                          <span className="text-green-400">✅ Approved</span>
                        )}
                        {challenge.userSubmission.status === "rejected" && (
                          <span className="text-red-400">❌ Rejected</span>
                        )}
                      </div>
                    ) : (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            onClick={() => setSelectedChallenge(challenge)}
                            className="bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
                          >
                            Submit Proof
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-gray-900 border-cyan-400/30">
                          <DialogHeader>
                            <DialogTitle className="text-cyan-400">Submit Proof</DialogTitle>
                            <DialogDescription className="text-gray-400">
                              Provide evidence that you completed: {challenge.title}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="proofText" className="text-cyan-400">Description</Label>
                              <Textarea
                                id="proofText"
                                value={proofText}
                                onChange={(e) => setProofText(e.target.value)}
                                placeholder="Describe what you did..."
                                className="bg-gray-800 border-gray-600 text-white"
                              />
                            </div>
                            <div>
                              <Label htmlFor="proofImageUrl" className="text-cyan-400">Image URL (optional)</Label>
                              <Input
                                id="proofImageUrl"
                                value={proofImageUrl}
                                onChange={(e) => setProofImageUrl(e.target.value)}
                                placeholder="https://example.com/image.jpg"
                                className="bg-gray-800 border-gray-600 text-white"
                              />
                            </div>
                            <Button
                              onClick={handleSubmitProof}
                              disabled={isSubmitting || (!proofText && !proofImageUrl)}
                              className="w-full bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
                            >
                              {isSubmitting ? "Submitting..." : "Submit Proof"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </CardContent>
                </Card>
              ))}
              
              {challenges?.length === 0 && (
                <Card className="bg-gray-900/50 border-cyan-400/30">
                  <CardContent className="text-center py-8">
                    <div className="text-gray-400">No active challenges available</div>
                  </CardContent>
                </Card>
              )}
            </motion.div>

            {/* My Created Challenges (creator can view submissions) */}
            <Card className="bg-gray-900/50 border-cyan-400/30">
              <CardHeader>
                <CardTitle className="text-cyan-400">My Created Challenges</CardTitle>
                <CardDescription className="text-gray-400">View submissions uploaded by participants</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(myChallenges || []).map((mc: any) => (
                  <div key={mc._id} className="p-4 bg-gray-800/40 rounded border border-gray-700 flex items-center justify-between">
                    <div className="text-sm">
                      <div className="text-cyan-400 font-bold">{mc.title}</div>
                      <div className="text-xs text-gray-500 uppercase">Type: {mc.type} • Status: {mc.status}</div>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          className="bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
                          onClick={() => setSelectedChallengeForSubs(mc._id)}
                        >
                          View Submissions
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-gray-900 border-cyan-400/30 max-h-[80vh] overflow-auto">
                        <DialogHeader>
                          <DialogTitle className="text-cyan-400">Submissions: {mc.title}</DialogTitle>
                          <DialogDescription className="text-gray-400">
                            Proofs uploaded by participants. (Approval remains admin-only.)
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                          {(submissionsForSelected || []).map((s: any) => (
                            <div key={s._id} className="p-3 bg-gray-800/40 rounded border border-gray-700">
                              <div className="flex items-center justify-between">
                                <div className="text-sm text-cyan-400">
                                  {s.submitter?.characterName ?? "Unknown"} <span className="text-gray-500">({s.submitter?.name ?? "Anonymous"})</span>
                                </div>
                                <div className="text-xs text-gray-500 uppercase">Status: {s.status}</div>
                              </div>
                              {s.proofText && (
                                <div className="mt-2 text-sm text-gray-300">
                                  {s.proofText}
                                </div>
                              )}
                              {s.proofImageUrl && (
                                <div className="mt-2">
                                  <a
                                    href={s.proofImageUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-cyan-400 underline text-sm"
                                  >
                                    View Image
                                  </a>
                                </div>
                              )}
                            </div>
                          ))}
                          {(!submissionsForSelected || submissionsForSelected.length === 0) && (
                            <div className="text-center py-6 text-gray-500 text-sm">
                              No submissions yet
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                ))}
                {myChallenges?.length === 0 && (
                  <div className="text-center py-6 text-gray-500 text-sm">You haven't created any challenges yet</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {leaderboard?.map((player: any, index: number) => (
                <Card key={player._id} className="bg-gray-900/50 border-cyan-400/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-2xl">
                          {index === 0 && "🥇"}
                          {index === 1 && "🥈"}
                          {index === 2 && "🥉"}
                          {index > 2 && `#${index + 1}`}
                        </div>
                        <div>
                          <div className="font-bold text-cyan-400">
                            {player.characterName}
                          </div>
                          <div className="text-sm text-gray-400">
                            {player.name}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-400">
                          {player.credits} CR
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </motion.div>
          </TabsContent>

          <TabsContent value="bets" className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4">
              {/* Open Events */}
              <Card className="bg-gray-900/50 border-cyan-400/30">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-cyan-400">Open Betting Events</CardTitle>
                      <CardDescription className="text-gray-400">Place a bet using your credits</CardDescription>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-cyan-400 text-cyan-400 hover:bg-cyan-400/10"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Bet
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-gray-900 border-cyan-400/30">
                        <DialogHeader>
                          <DialogTitle className="text-cyan-400">Create Betting Event</DialogTitle>
                          <DialogDescription className="text-gray-400">
                            Set the title, options with odds, and optional description/duration
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="betTitle" className="text-cyan-400">Title</Label>
                            <Input
                              id="betTitle"
                              value={betEvent.title}
                              onChange={(e) => setBetEvent((p) => ({ ...p, title: e.target.value }))}
                              placeholder="e.g., Highest marks in Math test"
                              className="bg-gray-800 border-gray-600 text-white"
                            />
                          </div>
                          <div>
                            <Label htmlFor="betDesc" className="text-cyan-400">Description (optional)</Label>
                            <Textarea
                              id="betDesc"
                              value={betEvent.description}
                              onChange={(e) => setBetEvent((p) => ({ ...p, description: e.target.value }))}
                              placeholder="Details about the event..."
                              className="bg-gray-800 border-gray-600 text-white"
                            />
                          </div>
                          <div>
                            <Label htmlFor="betOptions" className="text-cyan-400">Options</Label>
                            <Input
                              id="betOptions"
                              value={betEvent.optionsText}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBetEvent((p) => ({ ...p, optionsText: val }));
                                // Simple builder activates when no ":" present
                                if (!val.includes(":")) {
                                  const names = val
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean);
                                  setParsedNames(names);
                                  // Initialize or preserve multipliers; default to 2x
                                  const next: Record<string, number> = {};
                                  names.forEach((n) => {
                                    next[n] = (simpleMultipliers as any)[n] ?? 2;
                                  });
                                  setSimpleMultipliers(next);
                                } else {
                                  setParsedNames([]);
                                  setSimpleMultipliers({});
                                }
                              }}
                              placeholder='Simple: "Alice, Bob"  •  Advanced: "Alice:2.5, Bob:1.8"'
                              className="bg-gray-800 border-gray-600 text-white"
                            />
                            {/* Simple odds builder UI */}
                            {parsedNames.length > 0 && (
                              <div className="mt-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-400">
                                    Choose a win multiplier (x) for each option
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-cyan-400 text-cyan-400 hover:bg-cyan-400/10"
                                    onClick={() => {
                                      const all: Record<string, number> = {};
                                      parsedNames.forEach((n) => (all[n] = 2));
                                      setSimpleMultipliers(all);
                                    }}
                                  >
                                    Set all to 2x
                                  </Button>
                                </div>
                                <div className="space-y-2">
                                  {parsedNames.map((name) => {
                                    const mult = simpleMultipliers[name] ?? 2;
                                    return (
                                      <div
                                        key={name}
                                        className="flex items-center justify-between gap-3 p-2 bg-gray-800/50 rounded border border-gray-700"
                                      >
                                        <div className="text-sm text-cyan-400">{name}</div>
                                        <div className="flex items-center gap-2">
                                          <Select
                                            value={String(mult)}
                                            onValueChange={(v) =>
                                              setSimpleMultipliers((prev) => ({
                                                ...prev,
                                                [name]: parseFloat(v),
                                              }))
                                            }
                                          >
                                            <SelectTrigger className="w-32 bg-gray-900 border-gray-700 text-white">
                                              <SelectValue placeholder="Multiplier" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="1.1">1.1x</SelectItem>
                                              <SelectItem value="1.25">1.25x</SelectItem>
                                              <SelectItem value="1.5">1.5x</SelectItem>
                                              <SelectItem value="2">2x</SelectItem>
                                              <SelectItem value="3">3x</SelectItem>
                                              <SelectItem value="5">5x</SelectItem>
                                              <SelectItem value="10">10x</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                          <div>
                            <Label htmlFor="betDuration" className="text-cyan-400">Duration (hours)</Label>
                            <Input
                              id="betDuration"
                              type="number"
                              value={betEvent.durationHours}
                              onChange={(e) => setBetEvent((p) => ({ ...p, durationHours: parseInt(e.target.value) || 24 }))}
                              className="bg-gray-800 border-gray-600 text-white"
                            />
                          </div>
                          <Button
                            onClick={handleCreateBetEvent}
                            disabled={
                              creatingEvent ||
                              !betEvent.title.trim() ||
                              !betEvent.optionsText.trim() ||
                              // Disable if simple builder has < 2 names
                              (!betEvent.optionsText.includes(":") && parsedNames.length < 2)
                            }
                            className="w-full bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
                          >
                            {creatingEvent ? "Creating..." : "Create Event"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(openEvents || []).map((evt) => {
                    const sel = betSelections[evt._id] || { option: "", amount: 0 };
                    const alreadyBet = (myBets || []).some((b: any) => b.eventId === evt._id);
                    return (
                      <div key={evt._id} className="p-4 bg-gray-800/50 rounded border border-gray-700 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-cyan-400 font-bold">{evt.title}</div>
                            {evt.description && <div className="text-sm text-gray-400">{evt.description}</div>}
                          </div>
                          <div className="text-xs text-gray-500">
                            Status: <span className="text-green-400 uppercase">{evt.status}</span>
                            <span className="mx-2 text-gray-600">•</span>
                            <span className="text-cyan-400">Bets: {betCounts ? betCounts[String(evt._id)] ?? 0 : 0}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {evt.options?.map((opt: any) => (
                            <Button
                              key={opt.label}
                              size="sm"
                              variant={sel.option === opt.label ? "default" : "outline"}
                              className={sel.option === opt.label ? "bg-cyan-400 text-black" : "border-cyan-400 text-cyan-400 hover:bg-cyan-400/10"}
                              onClick={() =>
                                setBetSelections((prev) => ({
                                  ...prev,
                                  [evt._id]: { option: opt.label, amount: sel.amount },
                                }))
                              }
                            >
                              {opt.label} ({opt.odds}x)
                            </Button>
                          ))}
                        </div>

                        <div className="flex items-center gap-3">
                          <Input
                            type="number"
                            min={1}
                            value={sel.amount || ""}
                            onChange={(e) =>
                              setBetSelections((prev) => ({
                                ...prev,
                                [evt._id]: { option: sel.option, amount: parseInt(e.target.value) || 0 },
                              }))
                            }
                            placeholder="Amount (CR)"
                            className="bg-gray-800 border-gray-600 text-white w-40"
                          />
                          <Button
                            onClick={() => handlePlaceBet(evt)}
                            disabled={alreadyBet || !sel.option || !sel.amount || sel.amount <= 0}
                            className="bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
                          >
                            {alreadyBet ? "Already Bet" : "Place Bet"}
                          </Button>
                          {alreadyBet && (
                            <Button
                              variant="outline"
                              onClick={() => handleDeleteBet(evt._id)}
                              className="border-red-500 text-red-500 hover:bg-red-500/10"
                            >
                              Delete My Bet
                            </Button>
                          )}
                        </div>
                        {alreadyBet && <div className="text-xs text-yellow-400">You've already placed a bet on this event.</div>}
                      </div>
                    );
                  })}
                  {openEvents?.length === 0 && <div className="text-gray-400 text-center py-6">No open betting events</div>}
                </CardContent>
              </Card>

              {/* My Bets */}
              <Card className="bg-gray-900/50 border-cyan-400/30">
                <CardHeader>
                  <CardTitle className="text-cyan-400">My Bets</CardTitle>
                  <CardDescription className="text-gray-400">Your active and past bets</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(myBets || []).map((b: any) => (
                    <div key={b._id} className="flex items-center justify-between p-3 bg-gray-800/30 rounded border border-gray-700">
                      <div className="text-sm">
                        <div className="text-cyan-400">Event: {String(b.eventId)}</div>
                        <div className="text-gray-400">Option: {b.option}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-green-400 font-bold">{b.amount} CR</div>
                        <Button
                          variant="outline"
                          onClick={() => handleDeleteBet(b.eventId)}
                          className="border-red-500 text-red-500 hover:bg-red-500/10"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                  {myBets?.length === 0 && <div className="text-gray-400 text-center py-6">No bets placed yet</div>}
                </CardContent>
              </Card>

              {/* My Created Events Manager */}
              <Card className="bg-gray-900/50 border-green-500/30">
                <CardHeader>
                  <CardTitle className="text-green-500">My Created Events</CardTitle>
                  <CardDescription className="text-gray-400">Close or resolve your events</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(myCreatedEvents || []).map((evt) => (
                    <div key={evt._id} className="p-4 bg-gray-800/30 rounded border border-gray-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-cyan-400 font-bold">{evt.title}</div>
                          {evt.description && <div className="text-sm text-gray-400">{evt.description}</div>}
                          <div className="text-xs text-gray-500 mt-1">
                            Status: <span className="uppercase">{evt.status}</span>
                            {evt.resolvedOption && <span className="ml-2 text-yellow-400">Winner: {evt.resolvedOption}</span>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {evt.status === "open" && (
                            <Button
                              size="sm"
                              className="bg-yellow-400/20 border border-yellow-400 text-yellow-400 hover:bg-yellow-400/30"
                              onClick={() => handleCloseMyEvent(evt._id)}
                            >
                              Close
                            </Button>
                          )}
                          {evt.status !== "resolved" && (
                            <Button
                              size="sm"
                              className="bg-green-500/20 border border-green-500 text-green-500 hover:bg-green-500/30"
                              onClick={() => handleResolveMyEvent(evt._id)}
                            >
                              Resolve
                            </Button>
                          )}
                        </div>
                      </div>
                      {evt.status !== "resolved" && (
                        <div className="flex flex-wrap gap-2">
                          {evt.options?.map((opt: any) => (
                            <Button
                              key={opt.label}
                              size="sm"
                              variant={resolutions[evt._id] === opt.label ? "default" : "outline"}
                              className={resolutions[evt._id] === opt.label ? "bg-cyan-400 text-black" : "border-cyan-400 text-cyan-400 hover:bg-cyan-400/10"}
                              onClick={() => setResolutions((p) => ({ ...p, [evt._id]: opt.label }))}
                            >
                              {opt.label} ({opt.odds}x)
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {myCreatedEvents?.length === 0 && (
                    <div className="text-center py-8 text-gray-400">You haven't created any events yet</div>
                  )}
                </CardContent>
              </Card>

              {/* Loans */}
              <Card className="bg-gray-900/50 border-purple-500/30">
                <CardHeader>
                  <CardTitle className="text-purple-400">Loans</CardTitle>
                  <CardDescription className="text-gray-400">
                    Users with 0 credits can request a loan. Others may choose to fund it.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Borrower: create request when credits are 0 */}
                  {character.credits === 0 && (
                    <div className="p-4 bg-gray-800/40 rounded border border-gray-700 space-y-3">
                      <div className="text-sm text-gray-300">
                        You have 0 credits. Request a loan from classmates.
                      </div>
                      <div className="flex items-center gap-3">
                        <Input
                          type="number"
                          min={1}
                          value={loanAmount || ""}
                          onChange={(e) => setLoanAmount(parseInt(e.target.value) || 0)}
                          placeholder="Amount (CR)"
                          className="bg-gray-800 border-gray-600 text-white w-40"
                        />
                        <Button
                          className="bg-purple-500/20 border border-purple-500 text-purple-400 hover:bg-purple-500/30"
                          disabled={!loanAmount || loanAmount <= 0}
                          onClick={async () => {
                            try {
                              await createLoanRequest({ amount: loanAmount } as any);
                              toast.success("Loan request created");
                              setLoanAmount(100);
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Failed to create loan request");
                            }
                          }}
                        >
                          Request Loan
                        </Button>
                      </div>

                      {/* My loan requests */}
                      <div className="mt-2 space-y-2">
                        {(myLoanRequests || []).map((lr: any) => (
                          <div key={lr._id} className="flex items-center justify-between p-3 bg-gray-900/40 rounded border border-gray-700">
                            <div className="text-sm">
                              <div className="text-cyan-400">Requested: {lr.amount} CR</div>
                              <div className="text-xs text-gray-500 uppercase">Status: {lr.status}</div>
                            </div>
                            {lr.status === "pending" && (
                              <Button
                                variant="outline"
                                className="border-red-500 text-red-500 hover:bg-red-500/10"
                                onClick={async () => {
                                  try {
                                    await cancelLoanRequest({ loanId: lr._id } as any);
                                    toast.success("Loan request canceled");
                                  } catch (e) {
                                    toast.error(e instanceof Error ? e.message : "Failed to cancel");
                                  }
                                }}
                              >
                                Cancel
                              </Button>
                            )}
                          </div>
                        ))}
                        {myLoanRequests?.length === 0 && (
                          <div className="text-xs text-gray-500">No loan requests yet</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Lenders: view and fund pending requests */}
                  <div className="space-y-2">
                    <div className="text-sm text-gray-300">Open Loan Requests</div>
                    {(loanRequests || []).map((lr: any) => (
                      <div key={lr._id} className="flex items-center justify-between p-3 bg-gray-800/40 rounded border border-gray-700">
                        <div className="text-sm">
                          <div className="text-cyan-400">Amount: {lr.amount} CR</div>
                          <div className="text-xs text-gray-500">Borrower: {String(lr.borrowerId)}</div>
                        </div>
                        <Button
                          className="bg-green-500/20 border border-green-500 text-green-400 hover:bg-green-500/30"
                          onClick={async () => {
                            try {
                              await fundLoan({ loanId: lr._id } as any);
                              toast.success("Loan funded");
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Unable to fund loan");
                            }
                          }}
                        >
                          Fund
                        </Button>
                      </div>
                    ))}
                    {loanRequests?.length === 0 && (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        No open loan requests
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </main>

      <style>{`
        .glitch-text {
          text-shadow: 
            0.05em 0 0 #ff0080,
            -0.05em -0.025em 0 #00ffff,
            0.025em 0.05em 0 #00ff00;
        }
      `}</style>
    </div>
  );
}