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

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const character = useQuery(api.characters.getCharacter);
  const challenges = useQuery(api.challenges.getActiveChallenges) as any[] | undefined;
  const leaderboard = useQuery(api.characters.getLeaderboard);

  // Add missing submitProof mutation
  const submitProof = useMutation(api.challenges.submitProof);

  // Betting queries/mutations
  const openEvents = useQuery(api.bets.listOpenEvents) as any[] | undefined;
  const myBets = useQuery(api.bets.getMyBets) as any[] | undefined;
  const placeBet = useMutation(api.bets.placeBet);
  const createBetEvent = useMutation(api.bets.createEvent);

  const [selectedChallenge, setSelectedChallenge] = useState<any>(null);
  const [proofText, setProofText] = useState("");
  const [proofImageUrl, setProofImageUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Betting state
  const [betSelections, setBetSelections] = useState<Record<string, { option: string; amount: number }>>({});

  const [betEvent, setBetEvent] = useState({
    title: "",
    description: "",
    optionsText: "", // "Alice:2.5, Bob:1.8"
    durationHours: 24,
  });
  const [creatingEvent, setCreatingEvent] = useState(false);

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
    const raw = betEvent.optionsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const options = raw.map((entry) => {
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create event");
    } finally {
      setCreatingEvent(false);
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
              [{character.characterName}] LVL.{character.level}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400">{character.xp} XP</span>
            </div>
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
                        <div className="flex items-center gap-1 text-yellow-400 text-sm">
                          <Zap className="w-4 h-4" />
                          {challenge.xpReward} XP
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
                          {player.badges && player.badges.length > 0 && (
                            <div className="text-xs text-yellow-400 mt-1">
                              {player.badges.join(" ")}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-yellow-400">
                          {player.xp} XP
                        </div>
                        <div className="text-sm text-gray-400">
                          Level {player.level}
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
                            <Label htmlFor="betOptions" className="text-cyan-400">Options (label:odds, comma-separated)</Label>
                            <Input
                              id="betOptions"
                              value={betEvent.optionsText}
                              onChange={(e) => setBetEvent((p) => ({ ...p, optionsText: e.target.value }))}
                              placeholder="Alice:2.5, Bob:1.8"
                              className="bg-gray-800 border-gray-600 text-white"
                            />
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
                            disabled={creatingEvent || !betEvent.title.trim() || !betEvent.optionsText.trim()}
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
                      <div className="text-green-400 font-bold">{b.amount} CR</div>
                    </div>
                  ))}
                  {myBets?.length === 0 && <div className="text-gray-400 text-center py-6">No bets placed yet</div>}
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