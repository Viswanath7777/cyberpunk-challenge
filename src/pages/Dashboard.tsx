import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { motion } from "framer-motion";
import { Trophy, Zap, Target, Crown, LogOut, Settings } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const character = useQuery(api.characters.getCharacter);
  const challenges = useQuery(api.challenges.getActiveChallenges) as any[] | undefined;
  const leaderboard = useQuery(api.characters.getLeaderboard);
  const submitProof = useMutation(api.challenges.submitProof);
  
  const [selectedChallenge, setSelectedChallenge] = useState<any>(null);
  const [proofText, setProofText] = useState("");
  const [proofImageUrl, setProofImageUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
