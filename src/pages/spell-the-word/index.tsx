import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/api/axios";
import { useAuthStore } from "@/store/useAuthStore";
import {
  getLeaderboard,
  submitScore,
  type LeaderboardEntry,
} from "@/api/quiz/leaderboard";

// --- TYPE DEFINITIONS ---
interface WordItem {
  word_index: number;
  word_image: string | null;
  word_audio: string | null;
  hint?: string;
  letter_count: number;
  shuffled_letters?: string[];
}

interface SpellTheWordData {
  id: string;
  name: string;
  description: string;
  thumbnail_image: string | null;
  is_published: boolean;
  words: WordItem[];
  time_limit?: number;
  score_per_word: number;
}

interface GameResult {
  correct_words: number;
  total_words: number;
  max_score: number;
  score: number;
  percentage: number;
  time_taken: number;
}

// For demo - real data comes from backend
const DEMO_WORDS = [
  {
    word: "house",
    image: "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=400",
  },
  {
    word: "cloud",
    image: "https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=400",
  },
  {
    word: "mouse",
    image: "https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=400",
  },
  {
    word: "sound",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400",
  },
  {
    word: "found",
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400",
  },
];

// --- SOUND EFFECTS HOOK ---
const useSoundEffects = (isSoundOn: boolean) => {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
    return audioContextRef.current;
  }, []);

  const playTone = useCallback(
    (
      frequency: number,
      duration: number,
      type: OscillatorType = "sine",
      volume: number = 0.3,
    ) => {
      if (!isSoundOn) return;
      try {
        const ctx = getAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        gainNode.gain.setValueAtTime(volume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
          0.01,
          ctx.currentTime + duration,
        );
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration);
      } catch {
        console.log("Sound not available");
      }
    },
    [isSoundOn, getAudioContext],
  );

  const playCorrect = useCallback(() => {
    playTone(523.25, 0.1, "sine", 0.4);
    setTimeout(() => playTone(659.25, 0.1, "sine", 0.4), 100);
    setTimeout(() => playTone(783.99, 0.2, "sine", 0.4), 200);
  }, [playTone]);

  const playWrong = useCallback(() => {
    playTone(200, 0.3, "sawtooth", 0.2);
  }, [playTone]);

  const playClick = useCallback(() => {
    playTone(400, 0.05, "square", 0.1);
  }, [playTone]);

  const playSuccess = useCallback(() => {
    playTone(523.25, 0.15, "sine", 0.5);
    setTimeout(() => playTone(659.25, 0.15, "sine", 0.5), 150);
    setTimeout(() => playTone(783.99, 0.15, "sine", 0.5), 300);
    setTimeout(() => playTone(1046.5, 0.3, "sine", 0.5), 450);
  }, [playTone]);

  const playLetterPlace = useCallback(() => {
    playTone(600, 0.05, "triangle", 0.2);
  }, [playTone]);

  return { playCorrect, playWrong, playClick, playSuccess, playLetterPlace };
};

// --- DRAGGABLE LETTER TILE ---
const LetterTile = ({
  letter,
  onClick,
  isUsed,
  index,
  onDragStart,
}: {
  letter: string;
  onClick: () => void;
  isUsed: boolean;
  index: number;
  onDragStart: (index: number, letter: string) => void;
}) => {
  const [isBeingDragged, setIsBeingDragged] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    setIsBeingDragged(true);
    e.dataTransfer.setData("letterIndex", index.toString());
    e.dataTransfer.setData("letter", letter);
    e.dataTransfer.setData("source", "pool");
    e.dataTransfer.effectAllowed = "move";
    onDragStart(index, letter);
  };

  const handleDragEnd = () => {
    setIsBeingDragged(false);
  };

  return (
    <button
      onClick={onClick}
      disabled={isUsed}
      draggable={!isUsed}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`
        relative w-14 h-14 sm:w-16 sm:h-16
        rounded-xl font-bold text-2xl sm:text-3xl
        select-none
        transition-all duration-300 ease-out
        ${
          isUsed || isBeingDragged
            ? "opacity-30 scale-90 bg-slate-600/50 text-slate-500 cursor-not-allowed"
            : "bg-gradient-to-b from-cyan-400 to-cyan-600 text-white shadow-lg hover:scale-110 hover:shadow-xl cursor-grab active:cursor-grabbing active:scale-95 border-b-4 border-cyan-700 hover:-translate-y-1"
        }
        ${isBeingDragged ? "ring-2 ring-cyan-300 ring-opacity-50" : ""}
      `}
      style={{
        textShadow: isUsed ? "none" : "0 2px 4px rgba(0,0,0,0.3)",
        transform: isUsed ? "scale(0.9)" : undefined,
      }}
    >
      {letter.toLowerCase()}
    </button>
  );
};

// --- ANSWER SLOT (Droppable & Draggable) ---
const AnswerSlot = ({
  letter,
  slotIndex,
  onClick,
  isCorrect,
  isWrong,
  isSelected,
  onDrop,
  onDragOver,
  onDragStart,
  onDragLeave,
  isDragOver = false,
}: {
  letter: string | null;
  slotIndex: number;
  onClick: () => void;
  isCorrect: boolean;
  isWrong: boolean;
  isSelected: boolean;
  onDrop: (
    slotIndex: number,
    letterIndex: number,
    letter: string,
    source: string,
  ) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragStart: (slotIndex: number) => void;
  onDragLeave?: () => void;
  isDragOver?: boolean;
}) => {
  const [isBeingDragged, setIsBeingDragged] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
    const letterIndex = parseInt(e.dataTransfer.getData("letterIndex"));
    const droppedLetter = e.dataTransfer.getData("letter");
    const source = e.dataTransfer.getData("source") || "pool";
    onDrop(slotIndex, letterIndex, droppedLetter, source);
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (!letter) return;
    setIsBeingDragged(true);
    e.dataTransfer.setData("slotIndex", slotIndex.toString());
    e.dataTransfer.setData("letter", letter);
    e.dataTransfer.setData("source", "slot");
    e.dataTransfer.effectAllowed = "move";
    onDragStart(slotIndex);
  };

  const handleDragEnd = () => {
    setIsBeingDragged(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isHovering) setIsHovering(true);
    onDragOver(e);
  };

  const handleDragLeave = () => {
    setIsHovering(false);
    onDragLeave?.();
  };

  return (
    <div
      onClick={onClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      draggable={!!letter && !isCorrect && !isWrong}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`
        w-12 h-14 sm:w-14 sm:h-16
        rounded-lg font-bold text-2xl sm:text-3xl
        flex items-center justify-center
        transition-all duration-300 ease-out
        ${isBeingDragged ? "opacity-30 scale-90" : ""}
        ${
          letter
            ? isCorrect
              ? "bg-gradient-to-b from-green-400 to-green-600 text-white border-b-4 border-green-700 shadow-lg scale-105"
              : isWrong
                ? "bg-gradient-to-b from-red-400 to-red-600 text-white border-b-4 border-red-700 shadow-lg animate-shake"
                : "bg-gradient-to-b from-slate-100 to-slate-200 text-slate-800 border-b-4 border-slate-300 shadow-md cursor-grab hover:scale-110 hover:-translate-y-1 active:scale-95"
            : isHovering || isDragOver
              ? "bg-cyan-400/40 border-2 border-cyan-300 scale-110 shadow-lg"
              : isSelected
                ? "bg-cyan-500/30 border-2 border-cyan-400 scale-105"
                : "bg-slate-700/30 border-2 border-dashed border-slate-400/50 hover:border-cyan-400/50 hover:bg-slate-600/30"
        }
      `}
    >
      {letter ? (
        <span
          className="transition-all duration-200"
          style={{
            textShadow:
              letter && !isCorrect && !isWrong
                ? "none"
                : "0 1px 2px rgba(0,0,0,0.2)",
          }}
        >
          {letter.toLowerCase()}
        </span>
      ) : (
        <span className="text-slate-500/50 transition-opacity duration-200">
          _
        </span>
      )}
    </div>
  );
};

// --- INTRO SCREEN ---
const IntroScreen = ({
  gameName,
  gameDescription,
  onStart,
  onEnableAudio,
  onBack,
  isPreview = false,
}: {
  gameName: string;
  gameDescription: string;
  onStart: () => void;
  onEnableAudio?: () => void;
  onBack?: () => void;
  isPreview?: boolean;
}) => {
  return (
    <div
      onClick={onEnableAudio}
      className="absolute inset-0 z-[200] flex flex-col items-center justify-center cursor-pointer overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #87CEEB 0%, #1E90FF 50%, #006994 100%)",
      }}
    >
      {/* Back Button */}
      {onBack && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBack();
          }}
          className="absolute top-4 left-4 z-20 flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors backdrop-blur-sm pointer-events-auto"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          <span className="font-medium">Back</span>
        </button>
      )}

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/20 animate-float"
            style={{
              width: `${10 + Math.random() * 20}px`,
              height: `${10 + Math.random() * 20}px`,
              left: `${Math.random() * 100}%`,
              bottom: `-20px`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${4 + Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      <div className="z-10 text-center px-4 max-w-2xl">
        {isPreview && (
          <div className="mb-4">
            <span className="inline-block px-4 py-2 bg-purple-500 text-white text-sm font-bold rounded-full shadow-lg">
              🔍 PREVIEW MODE - This is a preview of your game
            </span>
          </div>
        )}
        <h1 className="text-5xl sm:text-7xl font-black text-white mb-4 tracking-tight drop-shadow-2xl">
          🔤 Spell the Word
        </h1>
        <h2 className="text-2xl sm:text-3xl font-bold text-white/90 mb-3 drop-shadow-lg">
          {gameName}
        </h2>
        <p className="text-white/80 text-base sm:text-lg mb-8 max-w-md mx-auto drop-shadow">
          {gameDescription || "Look at the image and spell the word correctly!"}
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStart();
          }}
          className="group relative flex items-center justify-center px-12 py-4 bg-gradient-to-b from-amber-400 to-amber-600 rounded-2xl hover:scale-110 transition-all duration-300 shadow-xl hover:shadow-2xl mx-auto border-b-4 border-amber-700 pointer-events-auto"
        >
          <span className="text-white font-black text-2xl tracking-wider drop-shadow">
            ▶ START GAME
          </span>
        </button>
        <p className="text-white/60 text-sm mt-6">
          Drag letters or type with keyboard!
        </p>
      </div>
    </div>
  );
};

// --- PAUSE OVERLAY ---
const PauseOverlay = ({ onResume }: { onResume: () => void }) => (
  <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center">
    <div className="text-center">
      <div className="text-6xl mb-4">⏸️</div>
      <h2 className="text-3xl font-bold text-white mb-6">Game Paused</h2>
      <button
        onClick={onResume}
        className="px-8 py-3 bg-gradient-to-b from-green-500 to-green-600 text-white font-bold text-xl rounded-xl hover:scale-105 transition-transform shadow-lg border-b-4 border-green-700"
      >
        ▶ Resume
      </button>
    </div>
  </div>
);

// --- RESULT SCREEN ---
const ResultScreen = ({
  result,
  onPlayAgain,
  onExit,
  leaderboard,
  isLoadingLeaderboard,
}: {
  result: GameResult;
  onPlayAgain: () => void;
  onExit: () => void;
  leaderboard: LeaderboardEntry[];
  isLoadingLeaderboard: boolean;
}) => {
  const {
    correct_words,
    total_words,
    score,
    max_score,
    percentage,
    time_taken,
  } = result;

  const starCount = (percentage / 100) * 5;
  const fullStars = Math.floor(starCount);
  const halfStar = starCount - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

  let feedback = "Good effort!";
  let feedbackEmoji = "👍";
  if (percentage === 100) {
    feedback = "Perfect Score!";
    feedbackEmoji = "🏆";
  } else if (percentage >= 80) {
    feedback = "Great job!";
    feedbackEmoji = "⭐";
  } else if (percentage >= 50) {
    feedback = "Nice try!";
    feedbackEmoji = "👏";
  } else {
    feedback = "Keep practicing!";
    feedbackEmoji = "💪";
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className="absolute inset-0 z-[200] flex items-start justify-center overflow-y-auto py-8"
      style={{
        background:
          "linear-gradient(180deg, #87CEEB 0%, #1E90FF 50%, #006994 100%)",
      }}
    >
      <div className="bg-white/20 backdrop-blur-md rounded-3xl p-8 mx-4 text-center max-w-md w-full space-y-4 border border-white/30 shadow-2xl my-auto min-h-fit">
        <div className="text-6xl mb-2">{feedbackEmoji}</div>
        <h2 className="text-3xl font-bold text-white drop-shadow">
          {feedback}
        </h2>
        <div className="text-5xl font-black text-white drop-shadow">
          {correct_words}/{total_words}
        </div>
        <div className="text-white/90">
          Score: <span className="text-amber-300 font-bold">{score}</span> /{" "}
          {max_score}
        </div>
        <div className="text-white/90">
          Time:{" "}
          <span className="text-cyan-300 font-bold">
            {formatTime(time_taken)}
          </span>
        </div>
        <div className="text-white/90">{percentage}% Accuracy</div>
        <div className="flex justify-center gap-1 text-3xl">
          {Array.from({ length: fullStars }).map((_, i) => (
            <span key={`full-${i}`} className="text-yellow-400 drop-shadow">
              ★
            </span>
          ))}
          {halfStar && <span className="text-yellow-400/50">★</span>}
          {Array.from({ length: emptyStars }).map((_, i) => (
            <span key={`empty-${i}`} className="text-white/30">
              ★
            </span>
          ))}
        </div>

        {/* Leaderboard Section - Top 5 Only */}
        <div className="mt-6 w-full max-w-md">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
            <h3 className="text-center text-xl font-bold text-yellow-300 mb-4 flex items-center justify-center gap-2">
              🏆 <span>Top 5 Leaderboard</span>
            </h3>
            {isLoadingLeaderboard ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
                <span className="ml-3 text-white/80">Loading...</span>
              </div>
            ) : (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => {
                  const rank = index + 1;
                  const entry = leaderboard[index];
                  const getMedalEmoji = (rank: number) => {
                    if (rank === 1) return "🥇";
                    if (rank === 2) return "🥈";
                    if (rank === 3) return "🥉";
                    return `${rank}.`;
                  };

                  // If entry exists, show the actual data
                  if (entry) {
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between px-3 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-bold w-8">
                            {getMedalEmoji(rank)}
                          </span>
                          <div className="flex items-center gap-2">
                            {entry.user?.profile_picture ? (
                              <img
                                src={entry.user.profile_picture}
                                alt={entry.player_name}
                                className="w-8 h-8 rounded-full object-cover border-2 border-white/30"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm border-2 border-white/30">
                                {entry.player_name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="text-white font-medium">
                              {entry.player_name}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-green-400 font-bold">
                            {entry.score}/{entry.max_score}
                          </div>
                          <div className="text-white/60 text-xs">
                            {entry.accuracy.toFixed(0)}% •{" "}
                            {Math.floor(entry.time_taken / 60)}:
                            {(entry.time_taken % 60)
                              .toString()
                              .padStart(2, "0")}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // If no entry, show placeholder
                  return (
                    <div
                      key={`empty-${rank}`}
                      className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg border border-dashed border-white/20"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold w-8 text-white/40">
                          {getMedalEmoji(rank)}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/30 font-bold text-sm border-2 border-dashed border-white/20">
                            ?
                          </div>
                          <span className="text-white/40 font-medium italic">
                            — Empty —
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white/30 font-bold">—</div>
                        <div className="text-white/20 text-xs">—</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-6">
          <button
            onClick={onPlayAgain}
            className="w-full py-3 bg-gradient-to-b from-amber-400 to-amber-600 text-white font-bold text-lg rounded-xl hover:scale-105 transition-transform shadow-lg border-b-4 border-amber-700"
          >
            🔄 Play Again
          </button>
          <button
            onClick={onExit}
            className="w-full py-3 bg-slate-700/80 text-white font-bold text-lg rounded-xl hover:bg-slate-600 transition-colors"
          >
            🏠 Exit to Home
          </button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN GAME COMPONENT ---
const SpellTheWordGame = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Game Data State
  const [gameData, setGameData] = useState<SpellTheWordData | null>(null);
  const [demoCorrectWords, setDemoCorrectWords] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Game State
  const [gameState, setGameState] = useState<"intro" | "playing" | "finished">(
    "intro",
  );
  const [isPaused, setIsPaused] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);

  // Timer per word removed (unused)
  const [timeLeft, setTimeLeft] = useState<number | null>(null); // Countdown
  const [totalTime, setTotalTime] = useState(0);

  // Word Spelling State
  const [shuffledLetters, setShuffledLetters] = useState<string[]>([]);
  const [usedLetterIndices, setUsedLetterIndices] = useState<Set<number>>(
    new Set(),
  );
  const [answerSlots, setAnswerSlots] = useState<
    { letter: string | null; sourceIndex: number | null }[]
  >([]);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isWrong, setIsWrong] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [lastCorrectAnswer, setLastCorrectAnswer] = useState<string>("");

  // Score State
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);

  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);

  // Settings
  const [isSoundOn, setIsSoundOn] = useState(true);
  const { playCorrect, playWrong, playClick, playSuccess, playLetterPlace } =
    useSoundEffects(isSoundOn);

  // Hint reveal state - tracks how many letters of the hint are revealed
  const [revealedHintCount, setRevealedHintCount] = useState(0);

  // Refs
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const themeAudioRef = useRef<HTMLAudioElement | null>(null);

  // Theme Audio - plays on page load with auto-loop
  useEffect(() => {
    // Create audio element for theme music
    const themeAudio = new Audio("/src/pages/spell-the-word/audio/theme.mp3");
    themeAudio.loop = true; // Auto-loop when song ends
    themeAudio.volume = 0.3; // Background music volume (30%)
    themeAudioRef.current = themeAudio;

    // Try to play audio (may be blocked by browser autoplay policy)
    const playTheme = async () => {
      try {
        await themeAudio.play();
      } catch {
        // Autoplay was blocked, will play after user interaction
        console.log(
          "Theme audio autoplay blocked, waiting for user interaction",
        );
      }
    };

    playTheme();

    // Cleanup on unmount
    return () => {
      if (themeAudioRef.current) {
        themeAudioRef.current.pause();
        themeAudioRef.current = null;
      }
    };
  }, []);

  // Control theme audio based on sound setting
  useEffect(() => {
    if (themeAudioRef.current) {
      if (isSoundOn) {
        themeAudioRef.current.volume = 0.3;
        // Try to resume if paused
        if (themeAudioRef.current.paused) {
          themeAudioRef.current.play().catch(() => {});
        }
      } else {
        themeAudioRef.current.volume = 0;
      }
    }
  }, [isSoundOn]);

  // Fetch Game Data
  useEffect(() => {
    const fetchGame = async () => {
      try {
        setIsLoading(true);

        // Check if this is a preview mode
        if (id === "preview") {
          const previewData = sessionStorage.getItem("spell-word-preview");
          if (previewData) {
            const preview = JSON.parse(previewData);

            // Transform preview data to game format
            const words = preview.words.map(
              (
                w: {
                  word_text: string;
                  word_image_preview: string;
                  hint?: string;
                },
                i: number,
              ) => {
                // Generate distractor letters for preview mode
                const wordText = w.word_text.toLowerCase();
                const alphabet = "abcdefghijklmnopqrstuvwxyz";
                const wordLetters = new Set(wordText.split(""));
                const availableLetters = alphabet
                  .split("")
                  .filter((l) => !wordLetters.has(l));

                // Calculate distractor count based on word length
                let distractorCount = 3;
                if (wordText.length <= 3) distractorCount = 2;
                else if (wordText.length <= 5) distractorCount = 3;
                else if (wordText.length <= 7) distractorCount = 4;
                else
                  distractorCount = Math.min(
                    5,
                    Math.floor(wordText.length * 0.5),
                  );

                const distractors: string[] = [];
                const tempAvailable = [...availableLetters];
                for (
                  let j = 0;
                  j < distractorCount && tempAvailable.length > 0;
                  j++
                ) {
                  const randomIdx = Math.floor(
                    Math.random() * tempAvailable.length,
                  );
                  distractors.push(tempAvailable[randomIdx]);
                  tempAvailable.splice(randomIdx, 1);
                }

                const allLetters = [...wordText.split(""), ...distractors];
                const shuffledLetters = allLetters.sort(
                  () => Math.random() - 0.5,
                );

                return {
                  word_index: i,
                  word_image: w.word_image_preview,
                  word_audio: null,
                  hint: w.hint || "",
                  letter_count: w.word_text.length,
                  shuffled_letters: shuffledLetters,
                };
              },
            );

            // Store correct words for validation
            setDemoCorrectWords(
              preview.words.map((w: { word_text: string }) =>
                w.word_text.toLowerCase(),
              ),
            );

            setGameData({
              id: "preview",
              name: preview.name,
              description: preview.description,
              thumbnail_image: null,
              is_published: false,
              words: words,
              time_limit: preview.time_limit,
              score_per_word: preview.score_per_word,
            });
          } else {
            setError("No preview data found");
          }
          setIsLoading(false);
          return;
        }

        // Normal game fetch
        const response = await api.get(
          `/api/game/game-type/spell-the-word/${id}/play/public`,
        );
        setGameData(response.data.data);
      } catch (err) {
        console.error("Failed to fetch game:", err);
        setError("Failed to load game. Using demo data.");
        // Fallback demo data
        setDemoCorrectWords(DEMO_WORDS.map((w) => w.word));
        setGameData({
          id: id || "test",
          name: "Spelling Practice",
          description: "Look at the image and spell the word!",
          thumbnail_image: null,
          is_published: true,
          words: DEMO_WORDS.map((w, i) => ({
            word_index: i,
            word_image: w.image,
            word_audio: null,
            hint: "",
            letter_count: w.word.length,
          })),
          time_limit: 30,
          score_per_word: 100,
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (id) fetchGame();
  }, [id]);

  // Shuffle array helper
  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // Initialize word
  const initializeWord = useCallback(
    (wordIndex: number) => {
      if (!gameData) return;

      const currentWord = gameData.words[wordIndex];
      const letterCount = currentWord.letter_count;

      // Use shuffled_letters from API if available, otherwise fallback to demo
      let letters: string[];
      if (
        currentWord.shuffled_letters &&
        currentWord.shuffled_letters.length > 0
      ) {
        letters = currentWord.shuffled_letters;
      } else if (demoCorrectWords.length > 0) {
        // Generate distractor letters for demo mode
        const wordText = demoCorrectWords[wordIndex].toLowerCase();
        const alphabet = "abcdefghijklmnopqrstuvwxyz";
        const wordLettersSet = new Set(wordText.split(""));
        const availableLetters = alphabet
          .split("")
          .filter((l) => !wordLettersSet.has(l));

        // Calculate distractor count based on word length
        let distractorCount = 3;
        if (wordText.length <= 3) distractorCount = 2;
        else if (wordText.length <= 5) distractorCount = 3;
        else if (wordText.length <= 7) distractorCount = 4;
        else distractorCount = Math.min(5, Math.floor(wordText.length * 0.5));

        const distractors: string[] = [];
        const tempAvailable = [...availableLetters];
        for (let j = 0; j < distractorCount && tempAvailable.length > 0; j++) {
          const randomIdx = Math.floor(Math.random() * tempAvailable.length);
          distractors.push(tempAvailable[randomIdx]);
          tempAvailable.splice(randomIdx, 1);
        }

        const allLetters = [...wordText.split(""), ...distractors];
        letters = shuffleArray(allLetters);
      } else {
        letters = Array(letterCount).fill("?");
      }

      setShuffledLetters(letters);
      setUsedLetterIndices(new Set());
      setAnswerSlots(
        Array(letterCount)
          .fill(null)
          .map(() => ({ letter: null, sourceIndex: null })),
      );
      setIsCorrect(false);
      setIsWrong(false);
      setSelectedSlot(0);
      setRevealedHintCount(0); // Reset hint reveal for new word
    },
    [gameData, demoCorrectWords],
  );

  // Start game
  const handleStart = () => {
    setGameState("playing");
    setCurrentWordIndex(0);
    setCorrectAnswers(0);
    setScore(0);
    setTotalTime(0);

    // Initialize countdown if time limit exists
    if (gameData?.time_limit) {
      setTimeLeft(gameData.time_limit);
    } else {
      setTimeLeft(null);
    }

    initializeWord(0);
  };

  // Preload audio when word changes
  useEffect(() => {
    if (
      gameState === "playing" &&
      gameData &&
      gameData.words[currentWordIndex]
    ) {
      const currentWord = gameData.words[currentWordIndex];
      if (currentWord.word_audio) {
        const audioUrl =
          currentWord.word_audio.startsWith("http") ||
          currentWord.word_audio.startsWith("data:")
            ? currentWord.word_audio
            : `${import.meta.env.VITE_API_URL}/${currentWord.word_audio}`;
        const audio = new Audio(audioUrl);
        audio.preload = "auto";
        audioRef.current = audio;
      } else {
        audioRef.current = null;
      }
    }
  }, [gameState, gameData, currentWordIndex]);

  // Place letter in slot
  const placeLetter = useCallback(
    (slotIndex: number, letterIndex: number, letter: string) => {
      playLetterPlace();

      // If slot already has a letter, return it to pool
      if (answerSlots[slotIndex].letter !== null) {
        const oldSourceIndex = answerSlots[slotIndex].sourceIndex;
        if (oldSourceIndex !== null) {
          setUsedLetterIndices((prev) => {
            const newSet = new Set(prev);
            newSet.delete(oldSourceIndex);
            return newSet;
          });
        }
      }

      const newSlots = [...answerSlots];
      newSlots[slotIndex] = { letter, sourceIndex: letterIndex };
      setAnswerSlots(newSlots);
      setUsedLetterIndices((prev) => new Set([...prev, letterIndex]));

      // Move selected slot to next empty
      const nextEmpty = newSlots.findIndex(
        (s, i) => i > slotIndex && s.letter === null,
      );
      setSelectedSlot(nextEmpty !== -1 ? nextEmpty : slotIndex);
    },
    [answerSlots, playLetterPlace],
  );

  // Remove letter from slot
  const removeLetter = useCallback(
    (slotIndex: number) => {
      const slot = answerSlots[slotIndex];
      if (!slot.letter || slot.sourceIndex === null) return;

      playClick();
      setUsedLetterIndices((prev) => {
        const newSet = new Set(prev);
        newSet.delete(slot.sourceIndex!);
        return newSet;
      });

      const newSlots = [...answerSlots];
      newSlots[slotIndex] = { letter: null, sourceIndex: null };
      setAnswerSlots(newSlots);
      setSelectedSlot(slotIndex); // Stay at this slot after removing
      setIsWrong(false);
    },
    [answerSlots, playClick],
  );

  // Keyboard input handler
  useEffect(() => {
    if (gameState !== "playing" || isPaused || isCorrect || isWrong) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      if (/^[a-z]$/.test(key)) {
        const letterIndex = shuffledLetters.findIndex(
          (l, idx) => l.toLowerCase() === key && !usedLetterIndices.has(idx),
        );
        // Find the first empty slot
        const firstEmptySlot = answerSlots.findIndex((s) => s.letter === null);
        if (letterIndex !== -1 && firstEmptySlot !== -1) {
          placeLetter(
            firstEmptySlot,
            letterIndex,
            shuffledLetters[letterIndex],
          );
        }
      }

      if (e.key === "Backspace") {
        // Find the slot to clear - current selected if filled, or previous filled
        let targetSlot = selectedSlot;
        if (answerSlots[selectedSlot]?.letter === null && selectedSlot > 0) {
          // Current slot is empty, go back to previous
          targetSlot = selectedSlot - 1;
        }
        if (answerSlots[targetSlot]?.letter !== null) {
          removeLetter(targetSlot);
          setSelectedSlot(targetSlot); // Stay at the slot we just cleared
        }
      }

      if (e.key === "Enter") {
        handleSubmit();
      }

      if (e.key === "ArrowLeft" && selectedSlot > 0) {
        setSelectedSlot(selectedSlot - 1);
      }

      if (e.key === "ArrowRight" && selectedSlot < answerSlots.length - 1) {
        setSelectedSlot(selectedSlot + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    gameState,
    isPaused,
    isCorrect,
    isWrong,
    shuffledLetters,
    usedLetterIndices,
    answerSlots,
    selectedSlot,
    placeLetter,
    removeLetter,
  ]);

  // Handle letter tile click
  const handleLetterClick = (index: number) => {
    if (usedLetterIndices.has(index) || isCorrect || isWrong) return;

    // Find the first empty slot
    const firstEmptySlot = answerSlots.findIndex((s) => s.letter === null);

    if (firstEmptySlot !== -1) {
      placeLetter(firstEmptySlot, index, shuffledLetters[index]);
    }
  };

  // Handle slot click
  const handleSlotClick = (slotIndex: number) => {
    if (isCorrect || isWrong) return;
    if (answerSlots[slotIndex].letter !== null) {
      removeLetter(slotIndex);
    } else {
      setSelectedSlot(slotIndex);
      playClick();
    }
  };

  // Handle drag & drop
  const handleDrop = (
    slotIndex: number,
    letterIndex: number,
    letter: string,
    source: string,
  ) => {
    if (isCorrect || isWrong) return;

    if (source === "slot") {
      // Dragging from another slot - swap or move
      const sourceSlotIndex = letterIndex; // letterIndex is actually slotIndex when from slot
      if (sourceSlotIndex === slotIndex) return;

      // Remove from source slot
      const sourceSlot = answerSlots[sourceSlotIndex];
      if (sourceSlot.sourceIndex !== null) {
        removeLetter(sourceSlotIndex);
        // Place in target slot
        placeLetter(slotIndex, sourceSlot.sourceIndex, letter);
      }
    } else {
      // Dragging from pool
      placeLetter(slotIndex, letterIndex, letter);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // State for pool drag over
  const [isPoolDragOver, setIsPoolDragOver] = useState(false);

  // Handle drop back to pool (return letter from answer slot)
  const handleDropToPool = (e: React.DragEvent) => {
    e.preventDefault();
    setIsPoolDragOver(false);
    const source = e.dataTransfer.getData("source");
    if (source === "slot") {
      const slotIndex = parseInt(e.dataTransfer.getData("slotIndex"));
      if (!isNaN(slotIndex) && answerSlots[slotIndex]?.letter) {
        removeLetter(slotIndex);
        playClick();
      }
    }
  };

  const handlePoolDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    // Show drop indicator when dragging over pool
    if (!isPoolDragOver) setIsPoolDragOver(true);
  };

  const handlePoolDragLeave = () => {
    setIsPoolDragOver(false);
  };

  // Handle hint reveal - reveal one more letter each time
  const handleRevealHint = () => {
    if (!gameData) return;
    const currentWord = gameData.words[currentWordIndex];
    const hint = currentWord.hint || "";
    if (revealedHintCount < hint.length) {
      setRevealedHintCount((prev) => prev + 1);
      playClick();
    }
  };

  // Get the partially revealed hint string
  const getRevealedHint = () => {
    if (!gameData) return "";
    const currentWord = gameData.words[currentWordIndex];
    const hint = currentWord.hint || "";
    if (!hint) return "";

    return hint
      .split("")
      .map((char, index) => {
        if (char === " ") return " "; // Keep spaces visible
        return index < revealedHintCount ? char : "_";
      })
      .join("");
  };

  // Handle slot drag start (for returning to pool via failed drop)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSlotDragStart = (slotIndex: number) => {
    // Visual feedback is handled by component state
  };

  // Submit answer
  const handleSubmit = async () => {
    if (!gameData) return;

    const allFilled = answerSlots.every((s) => s.letter !== null);
    if (!allFilled) {
      playClick();
      return;
    }

    const userAnswer = answerSlots
      .map((s) => s.letter)
      .join("")
      .toLowerCase();

    // If using demo mode (demoCorrectWords available), check locally
    if (demoCorrectWords.length > 0) {
      const correctWord = demoCorrectWords[currentWordIndex];
      if (userAnswer === correctWord) {
        setIsCorrect(true);
        playCorrect();

        // Update scores with new values
        const newCorrectAnswers = correctAnswers + 1;
        const newScore = score + (gameData.score_per_word || 100);
        setCorrectAnswers(newCorrectAnswers);
        setScore(newScore);

        // If this is the last word, finish game after animation
        if (currentWordIndex === gameData.words.length - 1) {
          setTimeout(() => {
            const totalWords = gameData.words.length;
            const maxScore = totalWords * (gameData.score_per_word || 100);
            const percentage = Math.round(
              (newCorrectAnswers / totalWords) * 100,
            );

            setResult({
              correct_words: newCorrectAnswers,
              total_words: totalWords,
              max_score: maxScore,
              score: newScore,
              percentage: percentage,
              time_taken: totalTime,
            });

            setGameState("finished");
            playSuccess();
          }, 1200);
        } else {
          setTimeout(() => moveToNextWord(), 1200);
        }
      } else {
        setIsWrong(true);
        setLastCorrectAnswer(correctWord);
        playWrong();
        setTimeout(() => moveToNextWord(), 1500);
      }
      return;
    }

    // For real backend, use API to check answer
    try {
      const response = await api.post(
        `/api/game/game-type/spell-the-word/${id}/check`,
        {
          answers: [{ word_index: currentWordIndex, user_answer: userAnswer }],
        },
      );

      const result = response.data.data.results[0];
      if (result.is_correct) {
        setIsCorrect(true);
        playCorrect();

        // Update scores with new values
        const newCorrectAnswers = correctAnswers + 1;
        const newScore = score + (gameData.score_per_word || 100);
        setCorrectAnswers(newCorrectAnswers);
        setScore(newScore);

        // If this is the last word, finish game after animation
        if (currentWordIndex === gameData.words.length - 1) {
          setTimeout(() => {
            const totalWords = gameData.words.length;
            const maxScore = totalWords * (gameData.score_per_word || 100);
            const percentage = Math.round(
              (newCorrectAnswers / totalWords) * 100,
            );

            setResult({
              correct_words: newCorrectAnswers,
              total_words: totalWords,
              max_score: maxScore,
              score: newScore,
              percentage: percentage,
              time_taken: totalTime,
            });

            setGameState("finished");
            playSuccess();
          }, 1200);
        } else {
          setTimeout(() => moveToNextWord(), 1200);
        }
      } else {
        setIsWrong(true);
        setLastCorrectAnswer(result.correct_answer);
        playWrong();
        setTimeout(() => moveToNextWord(), 1500);
      }
    } catch (err) {
      console.error("Failed to check answer:", err);
      // Fallback to treating as wrong
      setIsWrong(true);
      playWrong();
      setTimeout(() => moveToNextWord(), 1500);
    }
  };

  // Move to next word
  const moveToNextWord = () => {
    if (!gameData) return;

    if (currentWordIndex < gameData.words.length - 1) {
      const nextIndex = currentWordIndex + 1;
      setCurrentWordIndex(nextIndex);
      initializeWord(nextIndex);
    } else {
      finishGame();
    }
  };

  // Skip word
  const handleSkip = () => {
    if (!gameData || isCorrect || isWrong) return;
    playClick();
    moveToNextWord();
  };

  // Finish game
  const finishGame = () => {
    if (!gameData) return;

    const totalWords = gameData.words.length;
    const maxScore = totalWords * (gameData.score_per_word || 100);
    const percentage = Math.round((correctAnswers / totalWords) * 100);

    setResult({
      correct_words: correctAnswers,
      total_words: totalWords,
      max_score: maxScore,
      score: score,
      percentage: percentage,
      time_taken: totalTime,
    });

    setGameState("finished");
    playSuccess();
  };

  // Monitor Time Left
  useEffect(() => {
    if (timeLeft === 0 && gameState === "playing") {
      setIsWrong(true);
      playWrong();
      const timeout = setTimeout(() => {
        finishGame();
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [timeLeft, gameState]); // finishGame is accessed from closure. Warning: missing dep finishGame.

  // Main Timer Interval
  useEffect(() => {
    if (gameState === "playing" && !isPaused && !isCorrect && !isWrong) {
      timerRef.current = setInterval(() => {
        setTotalTime((prev) => prev + 1);
        setTimeLeft((prev) => {
          if (prev === null) return null;
          return Math.max(0, prev - 1);
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, isPaused, isCorrect, isWrong]);

  // Exit - show confirmation first
  const handleExit = () => {
    setShowExitConfirm(true);
  };

  // Confirm exit - actually perform the exit
  const confirmExit = async () => {
    setShowExitConfirm(false);

    // If this is preview mode, just close the window
    if (id === "preview") {
      window.close();
      return;
    }

    // For normal game, update play count and navigate to home
    try {
      await api.post("/api/game/play-count", { game_id: id });
    } catch (err) {
      console.error("Failed to update play count:", err);
    }
    navigate("/");
  };

  // Cancel exit
  const cancelExit = () => {
    setShowExitConfirm(false);
  };

  // Play again
  const handlePlayAgain = () => {
    setGameState("intro");
    setResult(null);
    setCurrentWordIndex(0);
    setCorrectAnswers(0);
    setScore(0);
    setTotalTime(0);
  };

  // Auto-submit score when game finishes
  useEffect(() => {
    const autoSubmitScore = async () => {
      if (gameState === "finished" && result && id && id !== "preview") {
        setIsLoadingLeaderboard(true);
        try {
          const { user } = useAuthStore.getState();
          const playerName = user?.username || "Anonymous";

          await submitScore(id, {
            player_name: playerName,
            score: result.score,
            max_score: result.max_score,
            time_taken: result.time_taken,
            accuracy: result.percentage,
          });

          // Auto-refresh leaderboard
          const data = await getLeaderboard(id);
          setLeaderboard(data);
        } catch (error) {
          console.error("Failed to auto-submit score:", error);
        } finally {
          setIsLoadingLeaderboard(false);
        }
      }
    };

    autoSubmitScore();
  }, [gameState, result, id]);

  // Format time

  // Loading state
  if (isLoading) {
    return (
      <div
        className="w-full h-screen flex justify-center items-center"
        style={{
          background:
            "linear-gradient(180deg, #87CEEB 0%, #1E90FF 50%, #006994 100%)",
        }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/30 border-t-white mx-auto mb-4" />
          <p className="text-white text-lg drop-shadow">Loading game...</p>
        </div>
      </div>
    );
  }

  if (error && !gameData) {
    return (
      <div
        className="w-full h-screen flex flex-col justify-center items-center gap-4"
        style={{
          background:
            "linear-gradient(180deg, #87CEEB 0%, #1E90FF 50%, #006994 100%)",
        }}
      >
        <p className="text-red-200 text-lg">{error}</p>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!gameData) return null;

  const currentWord = gameData.words[currentWordIndex];

  return (
    <div
      ref={gameContainerRef}
      className="w-full min-h-screen relative overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #87CEEB 0%, #1E90FF 50%, #006994 100%)",
      }}
    >
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-teal-900/30 to-transparent" />
      </div>

      {/* Intro Screen */}
      {gameState === "intro" && (
        <IntroScreen
          gameName={gameData.name}
          gameDescription={gameData.description}
          onStart={handleStart}
          onEnableAudio={() => {
            setIsSoundOn(true);
            // Also try to play theme audio after user interaction
            if (themeAudioRef.current) {
              themeAudioRef.current.play().catch(() => {});
            }
          }}
          onBack={handleExit}
          isPreview={id === "preview"}
        />
      )}

      {/* Pause Overlay */}
      {isPaused && gameState === "playing" && (
        <PauseOverlay onResume={() => setIsPaused(false)} />
      )}

      {/* Exit Confirmation Dialog */}
      {showExitConfirm && (
        <div className="absolute inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white/20 backdrop-blur-md rounded-3xl p-8 mx-4 text-center max-w-sm w-full border border-white/30 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="text-5xl mb-4">🚪</div>
            <h3 className="text-2xl font-bold text-white mb-2 drop-shadow">
              Exit Game?
            </h3>
            <p className="text-white/80 mb-6">
              Are you sure you want to exit? Your current progress will be lost.
            </p>
            <div className="flex gap-3">
              <button
                onClick={cancelExit}
                className="flex-1 py-3 bg-slate-600/80 hover:bg-slate-500 text-white font-bold rounded-xl transition-all hover:scale-105"
              >
                ✕ No, Stay
              </button>
              <button
                onClick={confirmExit}
                className="flex-1 py-3 bg-gradient-to-b from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white font-bold rounded-xl transition-all hover:scale-105 shadow-lg border-b-4 border-red-700"
              >
                ✓ Yes, Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result Screen */}
      {gameState === "finished" && result && (
        <ResultScreen
          result={result}
          onPlayAgain={handlePlayAgain}
          onExit={handleExit}
          leaderboard={leaderboard}
          isLoadingLeaderboard={isLoadingLeaderboard}
        />
      )}

      {/* Game UI */}
      {gameState === "playing" && (
        <div className="flex flex-col h-screen">
          {/* Header */}
          <header className="bg-black/20 backdrop-blur-sm px-4 py-3 grid grid-cols-3 items-center relative z-[50]">
            <div className="justify-self-start">
              <button
                onClick={handleExit}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors border border-white/10"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                <span className="hidden sm:inline font-medium">Exit</span>
              </button>
            </div>

            <div className="justify-self-center flex flex-col items-center">
              {id === "preview" && (
                <span className="px-3 py-0.5 bg-purple-500/80 text-white text-[10px] font-bold rounded-full mb-1 tracking-wider border border-white/20">
                  PREVIEW
                </span>
              )}
              <span className="font-bold text-xl text-white drop-shadow-md tracking-wide">
                {currentWordIndex + 1} of {gameData.words.length}
              </span>
            </div>

            <div className="justify-self-end flex items-center gap-2">
              <div className="text-white flex items-center gap-1.5 px-3 py-1.5 bg-black/20 rounded-lg border border-white/10 mr-1">
                <span className="text-green-400 font-bold">✓</span>
                <span className="font-bold">{correctAnswers}</span>
              </div>

              {/* Hint Button */}
              {currentWord.hint && (
                <button
                  onClick={handleRevealHint}
                  disabled={
                    revealedHintCount >= (currentWord.hint?.length || 0) ||
                    isCorrect ||
                    isWrong
                  }
                  className={`
                    px-3 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-1.5
                    ${
                      revealedHintCount >= (currentWord.hint?.length || 0)
                        ? "bg-green-500/30 text-green-200 cursor-not-allowed border border-green-500/20"
                        : "bg-amber-500 hover:bg-amber-400 text-white hover:scale-105 shadow-lg border-b-2 border-amber-600"
                    }
                  `}
                >
                  <span>💡</span>
                  <span className="hidden sm:inline">Hint</span>
                  {currentWord.hint && (
                    <span className="text-xs bg-black/20 px-1.5 py-0.5 rounded text-white/90">
                      {revealedHintCount}/{currentWord.hint.length}
                    </span>
                  )}
                </button>
              )}
              <button
                onClick={() => setIsPaused(true)}
                className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors border border-white/10"
              >
                ⏸️
              </button>
              <button
                onClick={() => setIsSoundOn(!isSoundOn)}
                className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors border border-white/10"
              >
                {isSoundOn ? "🔊" : "🔇"}
              </button>
            </div>
          </header>

          {/* Main Game Area */}
          <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-6 relative">
            {/* Countdown Timer - Displayed above image */}
            {timeLeft !== null && (
              <div
                className={`
                flex items-center gap-2 px-6 py-2 rounded-full font-bold text-lg shadow-xl border-2 mb-[-10px] z-10 transition-all duration-300
                ${
                  timeLeft <= 10
                    ? "bg-red-500 text-white border-red-300 animate-pulse scale-110"
                    : "bg-white/20 backdrop-blur-md text-white border-white/30"
                }
              `}
              >
                <span className="text-xl">⏳</span>
                <span className="tabular-nums tracking-widest">
                  {Math.floor(timeLeft / 60)}:
                  {(timeLeft % 60).toString().padStart(2, "0")}
                </span>
                {timeLeft <= 10 && (
                  <span className="text-xs uppercase ml-1 font-extrabold animate-bounce">
                    Hurry!
                  </span>
                )}
              </div>
            )}

            {/* Image with Audio Button */}
            <div className="flex flex-col items-center gap-4 relative">
              <div className="w-64 h-48 sm:w-80 sm:h-60 md:w-96 md:h-72 rounded-xl overflow-hidden bg-white shadow-2xl border-4 border-white">
                {currentWord.word_image ? (
                  <img
                    src={
                      currentWord.word_image.startsWith("http") ||
                      currentWord.word_image.startsWith("data:")
                        ? currentWord.word_image
                        : `${import.meta.env.VITE_API_URL}/${currentWord.word_image}`
                    }
                    alt="Spell this word"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src =
                        "https://via.placeholder.com/400x300?text=Image";
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                    <span className="text-6xl">🖼️</span>
                  </div>
                )}
              </div>

              {/* Audio Play Button - centered below image */}
              {currentWord.word_audio && (
                <button
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.currentTime = 0;
                      audioRef.current
                        .play()
                        .catch((err) =>
                          console.error("Audio play error:", err),
                        );
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-all border-b-4 border-amber-700"
                >
                  <span className="text-2xl">🔊</span>
                  <span>Play Sound</span>
                </button>
              )}
            </div>

            {/* Hint - Progressive Reveal */}
            {currentWord.hint && (
              <div className="text-white/90 text-lg text-center flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-cyan-200">Hint:</span>
                  <span className="font-mono tracking-wider">
                    {getRevealedHint()
                      .split("")
                      .map((char, index) => (
                        <span
                          key={index}
                          className={`
                          inline-block transition-all duration-300
                          ${
                            char === "_"
                              ? "text-slate-400/60 mx-0.5"
                              : "text-white font-bold animate-pulse-once"
                          }
                        `}
                          style={{
                            animationDelay: `${index * 50}ms`,
                          }}
                        >
                          {char}
                        </span>
                      ))}
                  </span>
                </div>
                {revealedHintCount === 0 && (
                  <span className="text-xs text-cyan-300/60">
                    Press the 💡 Hint button to reveal letters
                  </span>
                )}
                {revealedHintCount > 0 &&
                  revealedHintCount < (currentWord.hint?.length || 0) && (
                    <span className="text-xs text-amber-300/80">
                      {(currentWord.hint?.length || 0) - revealedHintCount}{" "}
                      letters remaining
                    </span>
                  )}
                {revealedHintCount >= (currentWord.hint?.length || 0) && (
                  <span className="text-xs text-green-300">
                    ✓ Fully revealed!
                  </span>
                )}
              </div>
            )}

            {/* Answer Slots */}
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
              {answerSlots.map((slot, index) => (
                <AnswerSlot
                  key={index}
                  letter={slot.letter}
                  slotIndex={index}
                  onClick={() => handleSlotClick(index)}
                  isCorrect={isCorrect}
                  isWrong={isWrong}
                  isSelected={selectedSlot === index && !isCorrect && !isWrong}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragStart={handleSlotDragStart}
                />
              ))}
            </div>

            {/* Feedback */}
            {isCorrect && (
              <div className="text-2xl font-bold text-green-300 animate-bounce drop-shadow-lg">
                ✓ Correct!
              </div>
            )}
            {isWrong && (
              <div className="text-2xl font-bold text-red-300 drop-shadow-lg">
                ✗ Wrong! Answer: {lastCorrectAnswer}
              </div>
            )}

            {/* Letter Tiles Pool - Drop zone to return letters */}
            <div
              className={`
                relative flex flex-wrap justify-center gap-2 sm:gap-3 max-w-lg p-4 rounded-2xl
                transition-all duration-300 ease-out min-h-[80px]
                ${
                  isPoolDragOver
                    ? "bg-cyan-500/20 ring-2 ring-cyan-400 ring-opacity-50 scale-[1.02] shadow-lg"
                    : "bg-transparent"
                }
              `}
              onDrop={handleDropToPool}
              onDragOver={handlePoolDragOver}
              onDragLeave={handlePoolDragLeave}
            >
              {shuffledLetters.map((letter, index) => (
                <LetterTile
                  key={index}
                  letter={letter}
                  onClick={() => handleLetterClick(index)}
                  isUsed={usedLetterIndices.has(index)}
                  index={index}
                  onDragStart={() => {}}
                />
              ))}
              {isPoolDragOver && (
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 pointer-events-none animate-pulse">
                  <span className="text-cyan-300 text-sm font-medium bg-slate-900/70 px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                    <span>⬇️</span> Drop here to return letter
                  </span>
                </div>
              )}
            </div>

            {/* Submit & Skip */}
            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={isCorrect || isWrong}
                className={`px-8 py-3 rounded-xl font-bold text-lg transition-all ${
                  answerSlots.every((s) => s.letter !== null) &&
                  !isCorrect &&
                  !isWrong
                    ? "bg-gradient-to-b from-amber-400 to-amber-600 text-white shadow-lg hover:scale-105 border-b-4 border-amber-700"
                    : "bg-slate-400/50 text-slate-300 cursor-not-allowed"
                }`}
              >
                Submit Answer
              </button>
              <button
                onClick={handleSkip}
                disabled={isCorrect || isWrong}
                className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white/80 rounded-xl transition-colors text-sm font-medium"
              >
                Skip →
              </button>
            </div>
          </main>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-5px); }
          40%, 80% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.3s ease-in-out; }
        @keyframes float {
          0% { transform: translateY(100vh); opacity: 0; }
          10% { opacity: 0.5; }
          100% { transform: translateY(-100px); opacity: 0; }
        }
        .animate-float { animation: float linear infinite; }
      `}</style>
    </div>
  );
};

export default SpellTheWordGame;
