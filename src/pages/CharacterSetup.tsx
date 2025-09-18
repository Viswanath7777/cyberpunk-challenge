import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import { Zap, User, Coins } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export default function CharacterSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const initializeCharacter = useMutation(api.characters.initializeCharacter);
  
  const [characterName, setCharacterName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateCharacter = async () => {
    if (!characterName.trim()) {
      toast.error("Please enter a character name");
      return;
    }

    setIsCreating(true);
    try {
      await initializeCharacter({
        characterName: characterName.trim(),
      });
      
      toast.success("Character created! Welcome to the competition!");
      navigate("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create character");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-cyan-400 font-mono flex items-center justify-center">
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

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative"
      >
        <Card className="w-full max-w-md bg-gray-900/80 border-cyan-400/50 backdrop-blur">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-cyan-400/20 rounded-full flex items-center justify-center border-2 border-cyan-400">
                <User className="w-8 h-8 text-cyan-400" />
              </div>
            </div>
            <CardTitle className="text-2xl text-cyan-400 glitch-text">
              Initialize Character
            </CardTitle>
            <CardDescription className="text-gray-400">
              Create your cyberpunk persona for the class competition
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="characterName" className="text-cyan-400">
                Character Name
              </Label>
              <Input
                id="characterName"
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder="Enter your hacker alias..."
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-500"
                maxLength={20}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isCreating) {
                    handleCreateCharacter();
                  }
                }}
              />
              <p className="text-xs text-gray-500">
                Choose wisely - this will be your identity in the competition
              </p>
            </div>

            <div className="bg-gray-800/50 p-4 rounded border border-gray-700">
              <h3 className="text-sm font-medium text-cyan-400 mb-2">Starting Stats:</h3>
              <div className="space-y-1 text-sm text-gray-300">
                <div className="flex justify-between">
                  <span>Level:</span>
                  <span className="text-cyan-400">1</span>
                </div>
                <div className="flex justify-between">
                  <span>XP:</span>
                  <span className="text-yellow-400 flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    0
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Credits:</span>
                  <span className="text-green-400 flex items-center gap-1">
                    <Coins className="w-3 h-3" />
                    1000
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Rank:</span>
                  <span className="text-gray-400">Rookie</span>
                </div>
              </div>
            </div>

            <Button
              onClick={handleCreateCharacter}
              disabled={isCreating || !characterName.trim()}
              className="w-full bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30 disabled:opacity-50"
            >
              {isCreating ? "Initializing..." : "Enter the Matrix"}
            </Button>

            <div className="text-center text-xs text-gray-500">
              Welcome, {user?.name || "Anonymous"}
            </div>
          </CardContent>
        </Card>
      </motion.div>

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