"use client";

import { motion } from "framer-motion";

interface UsageStatsProps {
  totalSessions: number;
  totalMessages: number;
  last7Days: { date: string; sessions: number; messages: number }[];
}

export function UsageStats({ totalSessions, totalMessages, last7Days }: UsageStatsProps) {
  const maxMessages = Math.max(...last7Days.map((d) => d.messages), 1);

  const formatDay = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { weekday: "short" });
  };

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="stat-card"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            </div>
            <span className="text-sm text-text-secondary">Sessions</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-text-primary font-mono tabular-nums">
              {totalSessions.toLocaleString()}
            </span>
            <span className="text-xs text-text-muted">last 7 days</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="stat-card"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className="text-sm text-text-secondary">Messages</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-text-primary font-mono tabular-nums">
              {totalMessages.toLocaleString()}
            </span>
            <span className="text-xs text-text-muted">last 7 days</span>
          </div>
        </motion.div>
      </div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="stat-card"
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-text-secondary">Message activity</span>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent" />
              Messages
            </span>
          </div>
        </div>

        {/* Bar chart */}
        <div className="flex items-end justify-between gap-2 h-32">
          {last7Days.map((day, index) => {
            const height = maxMessages > 0 ? (day.messages / maxMessages) * 100 : 0;
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full h-24 flex items-end">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(height, 4)}%` }}
                    transition={{ delay: 0.3 + index * 0.05, duration: 0.5, ease: "easeOut" }}
                    className="w-full bg-accent/20 rounded-t relative group cursor-pointer hover:bg-accent/30 transition-colors"
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-bg-elevated border border-border text-xs text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {day.messages} messages
                    </div>
                    {/* Glow effect on hover */}
                    <div className="absolute inset-0 bg-accent/0 group-hover:bg-accent/10 rounded-t transition-colors" />
                  </motion.div>
                </div>
                <span className="text-2xs text-text-muted">{formatDay(day.date)}</span>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
