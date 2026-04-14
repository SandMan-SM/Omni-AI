import { motion, AnimatePresence } from "framer-motion";
import { Bell, Trophy, TrendingUp, Award, X, Check, Swords, Zap } from "lucide-react";

interface Notification {
  id: number;
  type: "tournament" | "rank" | "badge" | "battle" | "sponsorship";
  message: string;
  time: string;
  read: boolean;
}

interface ArenaNotificationsProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkAsRead: (id: number) => void;
  isDarkMode: boolean;
}

const typeConfig = {
  tournament: { icon: Trophy, color: "text-amber-400", bg: "bg-amber-500/20" },
  rank: { icon: TrendingUp, color: "text-green-400", bg: "bg-green-500/20" },
  badge: { icon: Award, color: "text-purple-400", bg: "bg-purple-500/20" },
  battle: { icon: Swords, color: "text-red-400", bg: "bg-red-500/20" },
  sponsorship: { icon: Zap, color: "text-cyan-400", bg: "bg-cyan-500/20" },
};

export function ArenaNotifications({ isOpen, onClose, notifications, onMarkAsRead, isDarkMode }: ArenaNotificationsProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`absolute right-0 top-14 w-80 rounded-xl border shadow-2xl z-50 overflow-hidden ${
              isDarkMode 
                ? "bg-gray-900 border-white/10" 
                : "bg-white border-gray-200"
            }`}
          >
            <div className={`flex items-center justify-between p-4 border-b ${isDarkMode ? "border-white/5" : "border-gray-200"}`}>
              <div className="flex items-center gap-2">
                <Bell className={`w-5 h-5 ${isDarkMode ? "text-white" : "text-gray-900"}`} />
                <h3 className={`font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                  Notifications
                </h3>
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className={`p-1 rounded-full transition-colors ${isDarkMode ? "hover:bg-white/10" : "hover:bg-gray-100"}`}
              >
                <X className={`w-4 h-4 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`} />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className={`p-8 text-center ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}>
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const config = typeConfig[notification.type];
                  const Icon = config.icon;
                  
                  return (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-4 border-b last:border-b-0 transition-colors cursor-pointer ${
                        isDarkMode 
                          ? "border-white/5 hover:bg-white/5" 
                          : "border-gray-100 hover:bg-gray-50"
                      } ${!notification.read ? (isDarkMode ? "bg-cyan-500/5" : "bg-cyan-50/50") : ""}`}
                      onClick={() => onMarkAsRead(notification.id)}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-8 h-8 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-4 h-4 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                            {notification.message}
                          </p>
                          <p className={`text-xs mt-1 ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}>
                            {notification.time}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0 mt-2" />
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            <div className={`p-4 border-t ${isDarkMode ? "border-white/5" : "border-gray-200"}`}>
              <button className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                isDarkMode 
                  ? "bg-white/5 hover:bg-white/10 text-white" 
                  : "bg-gray-100 hover:bg-gray-200 text-gray-900"
              }`}>
                Mark all as read
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
