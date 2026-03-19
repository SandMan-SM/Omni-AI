import { motion } from "framer-motion";
import { Swords, Trophy, Crown, Star } from "lucide-react";

interface TournamentBracketProps {
  isDarkMode: boolean;
}

const sampleBracket = {
  rounds: [
    {
      name: "Quarter Finals",
      matches: [
        { id: 1, agent1: "Vanguard Prime", agent2: "Steel Phantom", winner: 1, score: "3-1" },
        { id: 2, agent1: "Iron Sentinel", agent2: "Night Watch", winner: 1, score: "3-2" },
        { id: 3, agent1: "Shadow Protocol", agent2: "Cyber Wolf", winner: 2, score: "1-3" },
        { id: 4, agent1: "Neon Striker", agent2: "Thunder Core", winner: null, score: null },
      ],
    },
    {
      name: "Semi Finals",
      matches: [
        { id: 5, agent1: "Vanguard Prime", agent2: "Iron Sentinel", winner: null, score: null },
        { id: 6, agent1: "Cyber Wolf", agent2: "TBD", winner: null, score: null },
      ],
    },
    {
      name: "Championship",
      matches: [
        { id: 7, agent1: "TBD", agent2: "TBD", winner: null, score: null },
      ],
    },
  ],
};

export function TournamentBracket({ isDarkMode }: TournamentBracketProps) {
  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-center gap-2 mb-6">
        <Trophy className={`w-5 h-5 ${isDarkMode ? "text-amber-400" : "text-amber-600"}`} />
        <span className={`font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>Bracket Preview</span>
      </div>

      <div className="flex items-center justify-center gap-4 overflow-x-auto pb-4">
        {sampleBracket.rounds.map((round, roundIndex) => (
          <div key={round.name} className="flex flex-col gap-4">
            <div className={`text-center text-xs font-medium mb-2 ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}>
              {round.name}
            </div>
            <div className="flex flex-col gap-3">
              {round.matches.map((match) => (
                <motion.div
                  key={match.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: roundIndex * 0.1 + match.id * 0.05 }}
                  className={`relative rounded-lg p-3 min-w-[160px] border ${
                    isDarkMode 
                      ? "bg-gray-800/50 border-white/10" 
                      : "bg-gray-50 border-gray-200"
                  } ${match.winner === null ? "opacity-50" : ""}`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                        {match.agent1}
                      </span>
                      {match.winner === 1 && (
                        <Crown className="w-4 h-4 text-amber-400" />
                      )}
                    </div>
                    <div className="flex items-center justify-center">
                      <Swords className={`w-3 h-3 mx-2 ${isDarkMode ? "text-gray-600" : "text-gray-400"}`} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                        {match.agent2}
                      </span>
                      {match.winner === 2 && (
                        <Crown className="w-4 h-4 text-amber-400" />
                      )}
                    </div>
                    {match.score && (
                      <div className={`text-center text-xs ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}>
                        {match.score}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={`mt-6 pt-4 border-t ${isDarkMode ? "border-white/5" : "border-gray-200"} text-center`}>
        <button className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
          isDarkMode 
            ? "bg-gradient-to-r from-cyan-500 to-amber-500 text-black hover:shadow-lg hover:shadow-cyan-500/25" 
            : "bg-gradient-to-r from-cyan-600 to-amber-600 text-white"
        }`}>
          Join Tournament
        </button>
      </div>
    </div>
  );
}
