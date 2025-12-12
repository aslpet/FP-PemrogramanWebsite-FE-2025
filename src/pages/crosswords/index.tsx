import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Play, Pause, LogOut } from "lucide-react";
import { Typography } from "@/components/ui/typography";
import api from "@/api/axios";
import { useCrosswordProgress } from "@/store/useCrosswordProgress";
import {
  useSaveProgress,
  type SaveProgressRequest,
} from "@/api/progress/useSaveProgress";
import { useAuthStore } from "@/store/useAuthStore";

// Helper convert detik ke MM:SS
const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export default function PlayCrossword() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [isPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timer, setTimer] = useState(0);

  const startGame = useCrosswordProgress((s) => s.startGame);
  const submitCorrect = useCrosswordProgress((s) => s.submitCorrect);
  const submitWrong = useCrosswordProgress((s) => s.submitWrong);
  // FIX: Ganti nama 'useHint' agar tidak dianggap sebagai React Hook oleh Linter
  const triggerHint = useCrosswordProgress((s) => s.useHint);
  const finishGame = useCrosswordProgress((s) => s.finishGame);
  const toPayload = useCrosswordProgress((s) => s.toPayload);
  const resetProgress = useCrosswordProgress((s) => s.reset);
  const getDurationMs = useCrosswordProgress((s) => s.getDurationMs);

  const user = useAuthStore((s) => s.user);
  const saveMutation = useSaveProgress();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && !isPaused) {
      interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, isPaused]);

  useEffect(() => {
    if (!id) return;
    startGame(id, { title: undefined });
    return () => {
      // cleanup if needed
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleExit = async () => {
    try {
      setIsPaused(true);
      await api.post("/api/game/play-count", { game_id: id });
    } catch (error) {
      console.error("Error logging play count", error);
    } finally {
      navigate("/");
    }
  };

  const handleTogglePause = () => {
    setIsPaused(!isPaused);
  };

  const handleSubmitWord = useCallback(
    (isCorrect: boolean) => {
      if (isCorrect) submitCorrect();
      else submitWrong();
    },
    [submitCorrect, submitWrong],
  );

  const handleUseHint = useCallback(() => {
    triggerHint(); // Panggil fungsi yang sudah direname
  }, [triggerHint]);

  const handleFinish = useCallback(async () => {
    finishGame();

    const payloadObj = toPayload(user?.id ?? null);
    if (!payloadObj) {
      resetProgress();
      return;
    }

    const req: SaveProgressRequest = {
      userId: payloadObj.userId ?? user?.id ?? null,
      puzzleId: payloadObj.puzzleId,
      startTime: payloadObj.startTime,
      endTime: payloadObj.endTime ?? Date.now(),
      durationMs:
        payloadObj.durationMs ??
        (payloadObj.endTime
          ? payloadObj.endTime - payloadObj.startTime
          : Date.now() - payloadObj.startTime),
      correctAnswers: payloadObj.correctAnswers,
      wrongAttempts: payloadObj.wrongAttempts,
      hintUsed: payloadObj.hintUsed,
      meta: payloadObj.meta ?? null,
    };

    try {
      await saveMutation.mutateAsync(req);
      resetProgress();
    } catch (err) {
      console.error("Save progress failed", err);
    }
  }, [finishGame, toPayload, user?.id, saveMutation, resetProgress]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white border-b p-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="destructive" size="sm" onClick={handleExit}>
            <LogOut className="w-4 h-4 mr-2" /> Exit Game
          </Button>

          <div className="text-xl font-mono font-bold bg-slate-100 px-3 py-1 rounded">
            {formatTime(timer)}
          </div>
        </div>

        <Button variant="outline" size="icon" onClick={handleTogglePause}>
          {isPaused ? (
            <Play className="w-4 h-4" />
          ) : (
            <Pause className="w-4 h-4" />
          )}
        </Button>
      </div>

      <div className="flex-1 p-6 flex justify-center">
        {isPaused ? (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-white p-8 rounded-xl text-center space-y-4">
              <Typography variant="h2">Game Paused</Typography>
              <Button size="lg" onClick={handleTogglePause}>
                Resume
              </Button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-4xl bg-white rounded-xl shadow-sm border p-6 min-h-[500px]">
            <Typography
              variant="h2"
              className="text-center text-slate-400 mt-20"
            >
              Crossword Grid Goes Here
            </Typography>
            <div className="mt-6 flex flex-col items-center gap-3">
              <div className="space-x-2">
                <Button onClick={() => handleSubmitWord(true)} size="sm">
                  Simulate Correct
                </Button>
                <Button onClick={() => handleSubmitWord(false)} size="sm">
                  Simulate Wrong
                </Button>
                <Button onClick={handleUseHint} size="sm">
                  Simulate Hint
                </Button>
                <Button onClick={handleFinish} size="sm">
                  Finish & Save
                </Button>
              </div>

              <div className="text-sm text-slate-500">
                <small>Duration (ms): {getDurationMs() ?? "-"}</small>
              </div>

              {saveMutation.isPending && (
                <div className="text-sm text-blue-600">Saving...</div>
              )}
              {saveMutation.isError && (
                <div className="text-sm text-red-600">
                  Failed to save progress.
                </div>
              )}
              {saveMutation.isSuccess && (
                <div className="text-sm text-green-600">Progress saved.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
