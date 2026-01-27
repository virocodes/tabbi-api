"use client";

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
    <div className="usage-stats">
      {/* Summary stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <span className="stat-card-label">Sessions</span>
          </div>
          <div className="stat-card-value">
            <span className="stat-number">{totalSessions.toLocaleString()}</span>
            <span className="stat-period">last 7 days</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <span className="stat-card-label">Messages</span>
          </div>
          <div className="stat-card-value">
            <span className="stat-number">{totalMessages.toLocaleString()}</span>
            <span className="stat-period">last 7 days</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="chart-card">
        <div className="chart-header">
          <span className="chart-title">Message activity</span>
          <div className="chart-legend">
            <span className="chart-legend-item">
              <span className="chart-legend-dot" />
              Messages
            </span>
          </div>
        </div>

        {/* Bar chart */}
        <div className="chart-bars">
          {last7Days.map((day, index) => {
            const height = maxMessages > 0 ? (day.messages / maxMessages) * 100 : 0;
            return (
              <div key={day.date} className="chart-bar-wrapper">
                <div className="chart-bar-container">
                  <div
                    className="chart-bar"
                    style={{
                      height: `${Math.max(height, 4)}%`,
                      animationDelay: `${300 + index * 50}ms`,
                    }}
                  >
                    {/* Tooltip */}
                    <div className="chart-tooltip">
                      {day.messages} messages
                    </div>
                  </div>
                </div>
                <span className="chart-bar-label">{formatDay(day.date)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
