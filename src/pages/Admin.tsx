import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { motion } from "framer-motion";
import { Plus, Check, X, ArrowLeft, Crown, Zap } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const pendingSubmissions = useQuery(api.challenges.getPendingSubmissions);
  const allChallenges = useQuery(api.challenges.getAllChallenges);
  const createChallenge = useMutation(api.challenges.createChallenge);
  const reviewSubmission = useMutation(api.challenges.reviewSubmission);
  const resetWeeklyXp = useMutation(api.characters.resetWeeklyXp);
  const listAllEvents = useQuery(api.bets.listAllEvents);
  const createBetEvent = useMutation(api.bets.createEvent);
  const closeBetEvent = useMutation(api.bets.closeEvent);
  const resolveBetEvent = useMutation(api.bets.resolveEvent);

  const [isCreating, setIsCreating] = useState(false);
  const [newChallenge, setNewChallenge] = useState({
    title: "",
    description: "",
    xpReward: 50,
    type: "daily" as "daily" | "weekly",
    durationHours: 24,
  });
  const [betEvent, setBetEvent] = useState({
    title: "",
    description: "",
    optionsText: "", // format: "Alice:2.5, Bob:1.8"
    durationHours: 24,
  });
  const [resolutions, setResolutions] = useState<Record<string, string>>({});

  // Redirect if not admin
  if (user?.role !== "admin") {
    navigate("/dashboard");
    return null;
  }

  const handleCreateChallenge = async () => {
    if (!newChallenge.title || !newChallenge.description) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsCreating(true);
    try {
      await createChallenge({
        title: newChallenge.title,
        description: newChallenge.description,
        xpReward: newChallenge.xpReward,
        type: newChallenge.type,
        durationHours: newChallenge.durationHours,
      });

      toast.success("Challenge created successfully!");
      setNewChallenge({
        title: "",
        description: "",
        xpReward: 50,
        type: "daily",
        durationHours: 24,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create challenge");
    } finally {
      setIsCreating(false);
    }
  };

  const handleReviewSubmission = async (submissionId: string, approved: boolean) => {
    try {
      await reviewSubmission({
        submissionId: submissionId as any,
        approved,
      });
      
      toast.success(approved ? "Submission approved!" : "Submission rejected!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to review submission");
    }
  };

  const handleResetWeekly = async () => {
    try {
      await resetWeeklyXp();
      toast.success("Weekly XP reset and badges awarded!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reset weekly XP");
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
    }
  };

  const handleCloseEvent = async (eventId: string) => {
    try {
      await closeBetEvent({ eventId: eventId as any });
      toast.success("Event closed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to close event");
    }
  };

  const handleResolveEvent = async (eventId: string) => {
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
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard")}
              className="text-cyan-400 hover:bg-cyan-400/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="text-2xl font-bold text-pink-500 glitch-text">
              <Crown className="w-6 h-6 inline mr-2" />
              ADMIN_PANEL
            </div>
          </div>
          
          <Button
            onClick={handleResetWeekly}
            className="bg-yellow-400/20 border border-yellow-400 text-yellow-400 hover:bg-yellow-400/30"
          >
            Reset Weekly & Award Badges
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 relative space-y-8">
        {/* Create Challenge Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-gray-900/50 border-cyan-400/30">
            <CardHeader>
              <CardTitle className="text-cyan-400 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Create New Challenge
              </CardTitle>
              <CardDescription className="text-gray-400">
                Add a new challenge for students to complete
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title" className="text-cyan-400">Title</Label>
                  <Input
                    id="title"
                    value={newChallenge.title}
                    onChange={(e) => setNewChallenge(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Challenge title..."
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="xpReward" className="text-cyan-400">XP Reward</Label>
                  <Input
                    id="xpReward"
                    type="number"
                    value={newChallenge.xpReward}
                    onChange={(e) => setNewChallenge(prev => ({ ...prev, xpReward: parseInt(e.target.value) || 0 }))}
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="description" className="text-cyan-400">Description</Label>
                <Textarea
                  id="description"
                  value={newChallenge.description}
                  onChange={(e) => setNewChallenge(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the challenge..."
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-cyan-400">Type</Label>
                  <Select
                    value={newChallenge.type}
                    onValueChange={(value: "daily" | "weekly") => 
                      setNewChallenge(prev => ({ ...prev, type: value }))
                    }
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="duration" className="text-cyan-400">Duration (hours)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={newChallenge.durationHours}
                    onChange={(e) => setNewChallenge(prev => ({ ...prev, durationHours: parseInt(e.target.value) || 24 }))}
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>
              </div>

              <Button
                onClick={handleCreateChallenge}
                disabled={isCreating}
                className="w-full bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
              >
                {isCreating ? "Creating..." : "Create Challenge"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Manage Betting Events */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-gray-900/50 border-cyan-400/30">
            <CardHeader>
              <CardTitle className="text-cyan-400">Create Betting Event</CardTitle>
              <CardDescription className="text-gray-400">Add an event students can bet on</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <Label htmlFor="betDuration" className="text-cyan-400">Duration (hours)</Label>
                  <Input
                    id="betDuration"
                    type="number"
                    value={betEvent.durationHours}
                    onChange={(e) => setBetEvent((p) => ({ ...p, durationHours: parseInt(e.target.value) || 24 }))}
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>
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
              <Button
                onClick={handleCreateBetEvent}
                className="w-full bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
              >
                Create Betting Event
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Events List & Actions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-gray-900/50 border-green-500/30">
            <CardHeader>
              <CardTitle className="text-green-500">All Betting Events</CardTitle>
              <CardDescription className="text-gray-400">Close or resolve events</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {listAllEvents?.map((evt) => (
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
                          onClick={() => handleCloseEvent(evt._id)}
                        >
                          Close
                        </Button>
                      )}
                      {evt.status !== "resolved" && (
                        <Button
                          size="sm"
                          className="bg-green-500/20 border border-green-500 text-green-500 hover:bg-green-500/30"
                          onClick={() => handleResolveEvent(evt._id)}
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
              {listAllEvents?.length === 0 && <div className="text-center py-8 text-gray-400">No betting events</div>}
            </CardContent>
          </Card>
        </motion.div>

        {/* Pending Submissions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gray-900/50 border-pink-500/30">
            <CardHeader>
              <CardTitle className="text-pink-500">
                Pending Submissions ({pendingSubmissions?.length || 0})
              </CardTitle>
              <CardDescription className="text-gray-400">
                Review and approve student submissions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingSubmissions?.map((submission) => (
                <Card key={submission._id} className="bg-gray-800/50 border-gray-600">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-cyan-400">
                            {submission.challenge?.title}
                          </h4>
                          <p className="text-sm text-gray-400">
                            by {submission.submitter?.characterName || submission.submitter?.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-yellow-400 text-sm">
                          <Zap className="w-4 h-4" />
                          {submission.challenge?.xpReward} XP
                        </div>
                      </div>
                      
                      {submission.proofText && (
                        <div>
                          <p className="text-sm text-gray-300 font-medium">Proof:</p>
                          <p className="text-sm text-gray-400 bg-gray-900/50 p-2 rounded">
                            {submission.proofText}
                          </p>
                        </div>
                      )}
                      
                      {submission.proofImageUrl && (
                        <div>
                          <p className="text-sm text-gray-300 font-medium">Image:</p>
                          <a
                            href={submission.proofImageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-cyan-400 hover:underline"
                          >
                            {submission.proofImageUrl}
                          </a>
                        </div>
                      )}
                      
                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={() => handleReviewSubmission(submission._id, true)}
                          size="sm"
                          className="bg-green-500/20 border border-green-500 text-green-500 hover:bg-green-500/30"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => handleReviewSubmission(submission._id, false)}
                          size="sm"
                          variant="outline"
                          className="border-red-500 text-red-500 hover:bg-red-500/10"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {pendingSubmissions?.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  No pending submissions
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* All Challenges Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gray-900/50 border-green-500/30">
            <CardHeader>
              <CardTitle className="text-green-500">All Challenges</CardTitle>
              <CardDescription className="text-gray-400">
                Overview of all created challenges
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {allChallenges?.map((challenge) => (
                  <div key={challenge._id} className="flex justify-between items-center p-3 bg-gray-800/30 rounded border border-gray-700">
                    <div>
                      <span className="text-cyan-400 font-medium">{challenge.title}</span>
                      <span className="text-xs text-gray-500 ml-2 uppercase">{challenge.type}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-yellow-400">{challenge.xpReward} XP</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        challenge.status === 'active' ? 'bg-green-500/20 text-green-400' :
                        challenge.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {challenge.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
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