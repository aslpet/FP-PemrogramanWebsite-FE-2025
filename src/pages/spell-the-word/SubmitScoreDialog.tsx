import { useState } from "react";
import { Trophy, User, Loader2 } from "lucide-react";
import { submitScore } from "@/api/quiz/leaderboard";
import toast from "react-hot-toast";

interface SubmitScoreDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: () => void;
  gameId: string;
  scoreData: {
    score: number;
    max_score: number;
    time_taken: number;
    accuracy: number;
  };
}

export default function SubmitScoreDialog({
  isOpen,
  onClose,
  onSubmitSuccess,
  gameId,
  scoreData,
}: SubmitScoreDialogProps) {
  const [playerName, setPlayerName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!playerName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitScore(gameId, {
        player_name: playerName.trim(),
        ...scoreData,
      });

      if (result.updated) {
        toast.success("Score submitted successfully!");
      } else {
        toast("Your previous score was better!");
      }

      onSubmitSuccess();
      onClose();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to submit score");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Submit Your Score
          </h2>
          <p className="text-gray-600">
            Enter your name to save your score to the leaderboard
          </p>
        </div>

        {/* Score Display */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 mb-6">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Your Score</p>
            <p className="text-4xl font-bold text-gray-900">
              {scoreData.score}/{scoreData.max_score}
            </p>
            <div className="flex justify-center gap-4 mt-3 text-sm text-gray-600">
              <div>
                <span className="font-semibold">
                  {Math.floor(scoreData.time_taken / 60)}:
                  {(scoreData.time_taken % 60).toString().padStart(2, "0")}
                </span>
                <span className="text-xs ml-1">time</span>
              </div>
              <div>
                <span className="font-semibold">
                  {scoreData.accuracy.toFixed(1)}%
                </span>
                <span className="text-xs ml-1">accuracy</span>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label
              htmlFor="playerName"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Your Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                id="playerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter your name"
                maxLength={50}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !playerName.trim()}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Score"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
