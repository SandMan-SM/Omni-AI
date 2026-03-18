import { motion } from "framer-motion";
import { Award, Zap, Flame, Shield, Trophy, Star, Target, TrendingUp, Clock, Users, Swords, Crown } from "lucide-react";

interface BadgeShowcaseProps {
  isDarkMode: boolean;
}

const badgeCategories = [
  {
    category: "Campaign",
    icon: Target,
    gradient: "from-purple-500 to-pink-500",
    badges: [
      { id: "first-contact", name: "First Contact", icon: Target, description: "Complete your first outreach mission" },
      { id: "campaign-launch", name: "Campaign Launch", icon: Zap, description: "Launch your first marketing campaign" },
      { id: "revenue-crusher", name: "Revenue Crusher", icon: TrendingUp, description: "Hit your first revenue milestone" },
    ],
  },
  {
    category: "Combat",
    icon: Swords,
    gradient: "from-red-500 to-orange-500",
    badges: [
      { id: "first-blood", name: "First Blood", icon: Swords, description: "Win your first battle" },
      { id: "undefeated", name: "Undefeated", icon: Flame, description: "Win 10 battles without a loss" },
      { id: "warrior", name: "Warrior", icon: Shield, description: "Complete 50 battles" },
      { id: "champion", name: "Champion", icon: Trophy, description: "Win a tournament" },
    ],
  },
  {
    category: "Speed",
    icon: Clock,
    gradient: "from-cyan-500 to-blue-500",
    badges: [
      { id: "rapid-response", name: "Rapid Response", icon: Zap, description: "Complete a mission in under 1 hour" },
      { id: "fastest-climb", name: "Fastest Climb", icon: TrendingUp, description: "Reach Gold in under 30 days" },
      { id: "flash-rankup", name: "Flash Rank-Up", icon: Star, description: "Rank up 3 times in one week" },
    ],
  },
  {
    category: "Elite",
    icon: Crown,
    gradient: "from-amber-400 to-yellow-500",
    badges: [
      { id: "diamond-blood", name: "Diamond Blood", icon: Crown, description: "Reach Diamond rank" },
      { id: "founding-member", name: "Founding Member", icon: Star, description: "Joined during founding period" },
      { id: "tournament-victor", name: "Tournament Victor", icon: Trophy, description: "Win a monthly championship" },
    ],
  },
  {
    category: "Community",
    icon: Users,
    gradient: "from-green-500 to-teal-500",
    badges: [
      { id: "mentor", name: "Mentor", icon: Users, description: "Help 10 agents rank up" },
      { id: "recruiter", name: "Recruiter", icon: Users, description: "Refer 5 new agents" },
      { id: "top-sponsor", name: "Top Sponsor", icon: Crown, description: "Sponsor 10 agents to Bronze" },
    ],
  },
];

export function BadgeShowcase({ isDarkMode }: BadgeShowcaseProps) {
  return (
    <div>
      <div className="text-center mb-10">
        <h2 className={`text-3xl md:text-4xl font-bold mb-3 ${isDarkMode ? "" : "text-gray-900"}`}>
          Military Badges & Achievements
        </h2>
        <p className={`${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
          Earn patches and commendations as you prove your worth in the Arena
        </p>
      </div>

      <div className="space-y-8">
        {badgeCategories.map((category, catIndex) => {
          const CategoryIcon = category.icon;
          return (
            <motion.div
              key={category.category}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: catIndex * 0.1 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${category.gradient} flex items-center justify-center`}>
                  <CategoryIcon className="w-5 h-5 text-white" />
                </div>
                <h3 className={`text-xl font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                  {category.category} Badges
                </h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {category.badges.map((badge, badgeIndex) => {
                  const BadgeIcon = badge.icon;
                  return (
                    <motion.div
                      key={badge.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: badgeIndex * 0.05 }}
                      viewport={{ once: true }}
                      whileHover={{ scale: 1.05, y: -2 }}
                      className={`relative group rounded-xl p-4 text-center border ${
                        isDarkMode 
                          ? "bg-gray-900/50 border-white/5 hover:border-white/20" 
                          : "bg-white border-gray-200 hover:border-gray-300"
                      } transition-all cursor-pointer`}
                    >
                      <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${category.gradient} opacity-0 group-hover:opacity-10 transition-opacity`} />
                      
                      <div className="relative">
                        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${category.gradient} p-[2px] mx-auto mb-3`}>
                          <div className={`w-full h-full rounded-full ${isDarkMode ? "bg-gray-900" : "bg-white"} flex items-center justify-center`}>
                            <BadgeIcon className="w-6 h-6 text-black" />
                          </div>
                        </div>
                        <h4 className={`font-bold text-sm mb-1 ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                          {badge.name}
                        </h4>
                        <p className={`text-xs ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}>
                          {badge.description}
                        </p>
                      </div>

                      <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br ${category.gradient} flex items-center justify-center`}>
                        <Award className="w-3 h-3 text-white" />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
