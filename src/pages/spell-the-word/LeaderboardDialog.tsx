import { Trophy, X, Clock, Target } from "lucide-react";
import type { LeaderboardEntry } from "@/api/quiz/leaderboard";

interface LeaderboardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  leaderboard: LeaderboardEntry[];
  currentScore?: {
    score: number;
    max_score: number;
    time_taken: number;
    accuracy: number;
  };
}

export default function LeaderboardDialog({
  isOpen,
  onClose,
  leaderboard,
  currentScore,
}: LeaderboardDialogProps) {
  if (!isOpen) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getMedalColor = (rank: number) => {
    if (rank === 1) return "text-yellow-500";
    if (rank === 2) return "text-gray-400";
    if (rank === 3) return "text-orange-600";
    return "text-gray-600";
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8" />
            <h2 className="text-2xl font-bold">Leaderboard</h2>
          </div>
          {currentScore && (
            <div className="mt-4 bg-white/10 rounded-lg p-4">
              <p className="text-sm opacity-90 mb-2">Your Score</p>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">
                  {currentScore.score}/{currentScore.max_score}
                </div>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatTime(currentScore.time_taken)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Target className="w-4 h-4" />
                    {currentScore.accuracy.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Leaderboard List */}
        <div className="overflow-y-auto max-h-[60vh]">
          {leaderboard.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Trophy className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg">No scores yet!</p>
              <p className="text-sm mt-2">
                Be the first to complete this game.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {leaderboard.map((entry, index) => {
                const rank = index + 1;
                return (
                  <div
                    key={entry.id}
                    className="p-4 hover:bg-gray-50 transition-colors flex items-center gap-4"
                  >
                    {/* Rank */}
                    <div
                      className={`w-12 text-center font-bold text-2xl ${getMedalColor(rank)}`}
                    >
                      {rank <= 3 ? (
                        <Trophy className="w-8 h-8 mx-auto" />
                      ) : (
                        <span>{rank}</span>
                      )}
                    </div>

                    {/* Player Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {entry.user?.profile_picture ? (
                          <img
                            src={entry.user.profile_picture}
                            alt={entry.player_name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                            {entry.player_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-900 truncate">
                            {entry.player_name}
                          </p>
                          {entry.user && (
                            <p className="text-xs text-gray-500">
                              @{entry.user.username}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      <div className="text-right">
                        <p className="font-bold text-lg text-gray-900">
                          {entry.score}/{entry.max_score}
                        </p>
                        <p className="text-xs text-gray-500">score</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(entry.time_taken)}
                        </p>
                        <p className="text-xs text-gray-500">time</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          {entry.accuracy.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500">accuracy</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
