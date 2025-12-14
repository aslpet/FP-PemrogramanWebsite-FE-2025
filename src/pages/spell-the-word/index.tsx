import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/api/axios";
import { useAuthStore } from "@/store/useAuthStore";
import {
  getLeaderboard,
  submitScore,
  type LeaderboardEntry,
} from "@/api/quiz/leaderboard";
import "./spell-the-word.css";

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

// --- ASSET PATHS (Centralized - only frequently used ones) ---
const ASSETS = {
  textButton: "/src/pages/spell-the-word/assets/page-2/text-button.png",
  themeAudio: "/src/pages/spell-the-word/audio/theme.mp3",
} as const;

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
        relative w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16
        select-none
        transition-all duration-300 ease-out
        ${
          isUsed || isBeingDragged
            ? "opacity-30 scale-90 cursor-not-allowed"
            : "cursor-grab active:cursor-grabbing hover:scale-110 active:scale-95 hover:-translate-y-1"
        }
        ${isBeingDragged ? "ring-2 ring-cyan-300 ring-opacity-50" : ""}
      `}
      style={{
        filter: isUsed
          ? "grayscale(100%)"
          : "drop-shadow(0 4px 8px rgba(0,0,0,0.5))",
      }}
    >
      <img
        src={ASSETS.textButton}
        alt=""
        className="w-full h-full object-contain"
      />
      <span
        className="absolute inset-0 flex items-center justify-center font-bold text-xl sm:text-2xl md:text-3xl text-amber-900"
        style={{ textShadow: "1px 1px 2px rgba(255,255,255,0.3)" }}
      >
        {letter.toUpperCase()}
      </span>
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
        relative w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18
        flex items-center justify-center
        transition-all duration-300 ease-out
        ${isBeingDragged ? "opacity-30 scale-90" : ""}
        ${
          !letter
            ? isHovering || isDragOver
              ? "bg-slate-700/80 border-2 border-cyan-400 scale-105 rounded-lg"
              : isSelected
                ? "bg-slate-700/60 border-2 border-cyan-500 rounded-lg"
                : "bg-slate-700/50 border-2 border-cyan-500/60 rounded-lg"
            : isCorrect
              ? "scale-105"
              : isWrong
                ? "animate-shake"
                : "cursor-grab hover:scale-110 active:scale-95"
        }
      `}
      style={{
        filter: letter
          ? "drop-shadow(0 4px 8px rgba(0,0,0,0.5))"
          : "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
      }}
    >
      {letter ? (
        <>
          <img
            src={ASSETS.textButton}
            alt=""
            className={`w-full h-full object-contain ${isCorrect ? "brightness-125 hue-rotate-90" : isWrong ? "brightness-75 hue-rotate-180" : ""}`}
          />
          <span
            className="absolute inset-0 flex items-center justify-center font-bold text-xl sm:text-2xl md:text-3xl text-amber-900"
            style={{ textShadow: "1px 1px 2px rgba(255,255,255,0.3)" }}
          >
            {letter.toUpperCase()}
          </span>
        </>
      ) : (
        <span className="text-slate-500/70 text-lg font-bold">_</span>
      )}
    </div>
  );
};

// --- INTRO SCREEN ---
const IntroScreen = ({
  onStart,
  onEnableAudio,
  onBack,
  isPreview = false,
  onPlayClick,
}: {
  gameName: string;
  gameDescription: string;
  onStart: () => void;
  onEnableAudio?: () => void;
  onBack?: () => void;
  isPreview?: boolean;
  onPlayClick?: () => void;
}) => {
  // Import assets from page-1 folder
  const backgroundImage =
    "/src/pages/spell-the-word/assets/page-1/background.jpg";
  const titleImage = "/src/pages/spell-the-word/assets/page-1/title.png";
  const playButtonImage =
    "/src/pages/spell-the-word/assets/page-1/play-button.png";
  const exitButtonImage =
    "/src/pages/spell-the-word/assets/page-1/exit-button.png";

  return (
    <div
      onClick={onEnableAudio}
      className="spell-the-word-game absolute inset-0 z-[200] flex flex-col items-center justify-center cursor-pointer overflow-hidden"
    >
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${backgroundImage})`,
        }}
      />

      {/* Overlay for better readability (optional, subtle) */}
      <div className="absolute inset-0 bg-black/10" />

      {/* Preview Badge */}
      {isPreview && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
          <span className="inline-block px-4 py-2 bg-purple-500 text-white text-sm font-bold rounded-full shadow-lg">
            🔍 PREVIEW MODE - This is a preview of your game
          </span>
        </div>
      )}

      {/* Main Content */}
      <div className="z-10 flex flex-col items-center justify-center px-4">
        {/* Title Logo */}
        <img
          src={titleImage}
          alt="Spell the Word"
          className="w-[500px] sm:w-[600px] md:w-[700px] lg:w-[800px] max-w-[90vw] h-auto mb-8 drop-shadow-2xl"
          style={{
            filter: "drop-shadow(0 10px 30px rgba(0,0,0,0.3))",
          }}
        />

        {/* Play Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlayClick?.();
            onStart();
          }}
          className="pointer-events-auto transition-all duration-300 hover:scale-110 active:scale-95 mb-3"
          style={{
            filter: "drop-shadow(0 8px 20px rgba(0,0,0,0.4))",
          }}
        >
          <img
            src={playButtonImage}
            alt="Play"
            className="w-[220px] sm:w-[280px] md:w-[320px] h-auto"
          />
        </button>

        {/* Exit Button */}
        {onBack && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlayClick?.();
              onBack();
            }}
            className="pointer-events-auto transition-all duration-300 hover:scale-110 active:scale-95"
            style={{
              filter: "drop-shadow(0 6px 15px rgba(0,0,0,0.4))",
            }}
          >
            <img
              src={exitButtonImage}
              alt="Exit"
              className="w-[180px] sm:w-[230px] md:w-[270px] h-auto"
            />
          </button>
        )}
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
  onPlayClick,
}: {
  result: GameResult;
  onPlayAgain: () => void;
  onExit: () => void;
  leaderboard: LeaderboardEntry[];
  isLoadingLeaderboard: boolean;
  onPlayClick?: () => void;
}) => {
  const {
    correct_words,
    total_words,
    score,
    max_score,
    percentage,
    time_taken,
  } = result;

  let feedback = "Good effort!";
  if (percentage === 100) {
    feedback = "Perfect Score!";
  } else if (percentage >= 80) {
    feedback = "Great job!";
  } else if (percentage >= 50) {
    feedback = "Nice try!";
  } else {
    feedback = "Keep practicing!";
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className="spell-the-word-game absolute inset-0 z-[200] flex items-center justify-center overflow-hidden"
      style={{
        backgroundImage: `url(/src/pages/spell-the-word/assets/page-3/background.jpg)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Scroll Container */}
      <div
        className="relative flex flex-col items-center"
        style={{
          filter: "drop-shadow(0 10px 30px rgba(0,0,0,0.5))",
        }}
      >
        <img
          src="/src/pages/spell-the-word/assets/page-3/scroll.png"
          alt="Scroll"
          className="h-[95vh] min-w-[500px] sm:min-w-[550px] md:min-w-[600px] object-fill"
        />

        {/* Content overlaid on scroll */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-16 sm:px-20 md:px-24">
          {/* Top Section: Title, Score, Stats */}
          <div className="flex flex-col items-center">
            {/* Feedback Title */}
            <h1
              className="text-2xl sm:text-3xl md:text-4xl font-bold text-purple-800 text-center mb-0"
              style={{ textShadow: "1px 1px 2px rgba(255,255,255,0.5)" }}
            >
              {feedback.toUpperCase()}
            </h1>

            {/* Score Fraction */}
            <div
              className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-800 mb-2"
              style={{ textShadow: "1px 1px 2px rgba(255,255,255,0.3)" }}
            >
              {correct_words}/{total_words}
            </div>

            {/* Score Details */}
            <div className="text-center space-y-0">
              <div className="text-sm sm:text-base text-slate-700 font-bold">
                SCORE : <span className="text-amber-600">{score}</span> /{" "}
                {max_score}
              </div>
              <div className="text-sm sm:text-base text-slate-700 font-bold">
                TIME :{" "}
                <span className="text-blue-600">{formatTime(time_taken)}</span>
              </div>
              <div className="text-sm sm:text-base text-slate-700 font-bold">
                {percentage}% ACCURACY
              </div>
            </div>
          </div>

          {/* Leaderboard Box */}
          <div className="w-full bg-white/30 backdrop-blur-sm rounded-lg border border-slate-400/50 p-3">
            <h3 className="text-center text-sm font-bold text-amber-700 mb-2">
              🏆 TOP 3 LEADERBOARD
            </h3>
            {isLoadingLeaderboard ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600"></div>
                <span className="ml-2 text-slate-600 text-sm">Loading...</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {/* Top 3 - Always visible */}
                {Array.from({ length: 3 }).map((_, index) => {
                  const rank = index + 1;
                  const entry = leaderboard[index];
                  const getMedalEmoji = (r: number) => {
                    if (r === 1) return "🥇";
                    if (r === 2) return "🥈";
                    if (r === 3) return "🥉";
                    return `${r}.`;
                  };

                  if (entry) {
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between px-2 py-1.5 bg-white/70 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold w-6 text-sm">
                            {getMedalEmoji(rank)}
                          </span>
                          {entry.user?.profile_picture ? (
                            <img
                              src={entry.user.profile_picture}
                              alt={entry.player_name}
                              className="w-6 h-6 rounded-full object-cover border border-slate-300"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-xs">
                              {entry.player_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-slate-700 font-medium text-sm truncate max-w-[80px]">
                            {entry.player_name}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-amber-700 font-bold text-sm">
                            {entry.score}/{entry.max_score}
                          </div>
                          <div className="text-slate-500 text-xs flex items-center justify-end gap-1">
                            <span>
                              ⏱️{Math.floor(entry.time_taken / 60)}:
                              {(entry.time_taken % 60)
                                .toString()
                                .padStart(2, "0")}
                            </span>
                            <span>•</span>
                            <span>{entry.accuracy.toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`empty-${rank}`}
                      className="flex items-center justify-between px-2 py-1.5 bg-white/40 rounded-lg border border-dashed border-slate-300"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold w-6 text-sm text-slate-400">
                          {getMedalEmoji(rank)}
                        </span>
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 text-xs">
                          ?
                        </div>
                        <span className="text-slate-400 font-medium text-sm italic">
                          Empty
                        </span>
                      </div>
                      <div className="text-slate-300 font-bold text-sm">—</div>
                    </div>
                  );
                })}

                {/* Entries 4-5 - Scrollable with hidden scrollbar */}
                {leaderboard.length > 3 && (
                  <div
                    className="max-h-20 overflow-y-auto scrollbar-hide space-y-1.5 mt-1 pt-1 border-t border-slate-300/50"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                  >
                    {leaderboard.slice(3, 5).map((entry, index) => {
                      const rank = index + 4;
                      return (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between px-2 py-1.5 bg-white/70 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold w-6 text-sm text-slate-600">
                              {rank}.
                            </span>
                            {entry.user?.profile_picture ? (
                              <img
                                src={entry.user.profile_picture}
                                alt={entry.player_name}
                                className="w-6 h-6 rounded-full object-cover border border-slate-300"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-xs">
                                {entry.player_name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="text-slate-700 font-medium text-sm truncate max-w-[80px]">
                              {entry.player_name}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="text-amber-700 font-bold text-sm">
                              {entry.score}/{entry.max_score}
                            </div>
                            <div className="text-slate-500 text-xs flex items-center justify-end gap-1">
                              <span>
                                ⏱️{Math.floor(entry.time_taken / 60)}:
                                {(entry.time_taken % 60)
                                  .toString()
                                  .padStart(2, "0")}
                              </span>
                              <span>•</span>
                              <span>{entry.accuracy.toFixed(0)}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex flex-col items-center gap-2 w-full">
            {/* Play Again Button */}
            <button
              onClick={() => {
                onPlayClick?.();
                onPlayAgain();
              }}
              className="transition-all duration-300 hover:scale-105 active:scale-95"
              style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))" }}
            >
              <img
                src="/src/pages/spell-the-word/assets/page-3/PlayAgain-button.png"
                alt="Play Again"
                className="w-48 h-14 sm:w-56 sm:h-16 md:w-64 md:h-18"
              />
            </button>

            {/* Exit Button */}
            <button
              onClick={() => {
                onPlayClick?.();
                onExit();
              }}
              className="transition-all duration-300 hover:scale-105 active:scale-95"
              style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))" }}
            >
              <img
                src="/src/pages/spell-the-word/assets/page-3/exit-button.png"
                alt="Exit"
                className="w-48 h-14 sm:w-56 sm:h-16 md:w-64 md:h-18"
              />
            </button>
          </div>
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
  const [showImagePopup, setShowImagePopup] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);

  // Timer State
  const [timeLeft, setTimeLeft] = useState<number | null>(null); // Countdown per word
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
    const themeAudio = new Audio(ASSETS.themeAudio);
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
                  word_audio_preview?: string;
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
                  word_audio: w.word_audio_preview || null,
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
        setError("Failed to load game. Please try again later.");
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
  const handleSlotDragStart = (_slotIndex: number) => {
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
      // Reset timer for new word (time_limit is per-word, not total)
      if (gameData.time_limit) {
        setTimeLeft(gameData.time_limit);
      }
    } else {
      finishGame();
    }
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

  // Handle skip - mark as wrong and move to next
  const handleSkip = async () => {
    if (!gameData || isCorrect || isWrong) return;

    // Get correct answer for display
    if (demoCorrectWords.length > 0) {
      setLastCorrectAnswer(demoCorrectWords[currentWordIndex]);
    } else {
      try {
        const response = await api.post(
          `/api/game/game-type/spell-the-word/${id}/check`,
          { answers: [{ word_index: currentWordIndex, user_answer: "" }] },
        );
        const result = response.data.data.results[0];
        setLastCorrectAnswer(result.correct_answer || "");
      } catch {
        setLastCorrectAnswer("(tidak tersedia)");
      }
    }

    setIsWrong(true);
    playWrong();
    setTimeout(() => moveToNextWord(), 1500);
  };

  // Handle timeout - auto-check if slots filled, otherwise get correct answer and move to next
  const handleTimeOut = async () => {
    if (!gameData) return;

    // Check if all slots are filled - auto-submit the answer
    const allFilled = answerSlots.every((s) => s.letter !== null);
    if (allFilled) {
      // Auto-submit the answer
      await handleSubmit();
      return;
    }

    // Slots not filled - mark as wrong and show correct answer
    // For demo mode, use local correct words
    if (demoCorrectWords.length > 0) {
      const correctWord = demoCorrectWords[currentWordIndex];
      setLastCorrectAnswer(correctWord);
      setIsWrong(true);
      playWrong();
      setTimeout(() => moveToNextWord(), 1500);
      return;
    }

    // For API mode, call check endpoint with empty answer to get correct word
    try {
      const response = await api.post(
        `/api/game/game-type/spell-the-word/${id}/check`,
        {
          answers: [{ word_index: currentWordIndex, user_answer: "" }],
        },
      );
      const result = response.data.data.results[0];
      setLastCorrectAnswer(result.correct_answer || "");
    } catch (err) {
      console.error("Failed to get correct answer:", err);
      setLastCorrectAnswer("(tidak tersedia)");
    }

    setIsWrong(true);
    playWrong();
    setTimeout(() => moveToNextWord(), 1500);
  };

  // Monitor Time Left - when time runs out on current word, move to next
  useEffect(() => {
    if (timeLeft === 0 && gameState === "playing" && !isWrong && !isCorrect) {
      handleTimeOut();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, gameState]);

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
      className="spell-the-word-game w-full min-h-screen relative overflow-hidden"
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
          onPlayClick={playClick}
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
          onPlayClick={playClick}
        />
      )}

      {/* Game UI */}
      {gameState === "playing" && (
        <div
          className="spell-the-word-game flex flex-col h-screen relative"
          style={{
            backgroundImage: `url(/src/pages/spell-the-word/assets/page-2/background.jpg)`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          {/* Dark overlay for better contrast */}
          <div className="absolute inset-0 bg-black/20 pointer-events-none" />

          {/* Header Bar */}
          <header className="relative z-[50] px-4 py-4 flex items-center justify-between bg-slate-900/70 backdrop-blur-sm">
            {/* Left - Back Button */}
            <button
              onClick={() => {
                playClick();
                handleExit();
              }}
              className="transition-all duration-300 hover:scale-110 active:scale-95"
              style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.6))" }}
            >
              <img
                src="/src/pages/spell-the-word/assets/page-2/back-button.png"
                alt="Exit"
                className="w-16 h-16 sm:w-20 sm:h-20"
              />
            </button>

            {/* Center - Word Progress (Absolute centered) */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none">
              {id === "preview" && (
                <span className="px-3 py-0.5 bg-purple-500/80 text-white text-[10px] font-bold rounded-full mb-1 tracking-wider">
                  PREVIEW
                </span>
              )}
              <span
                className="font-bold text-2xl sm:text-3xl text-white tracking-wide"
                style={{ textShadow: "3px 3px 6px rgba(0,0,0,0.9)" }}
              >
                {currentWordIndex + 1} OF {gameData.words.length}
              </span>
            </div>

            {/* Right - Score, Pause, Sound */}
            <div className="flex items-center gap-4">
              {/* Score Counter */}
              <div
                className="relative flex items-center justify-center"
                style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.6))" }}
              >
                <img
                  src="/src/pages/spell-the-word/assets/page-2/checklist-button.png"
                  alt="Score"
                  className="w-16 h-16 sm:w-20 sm:h-20"
                />
                <span
                  className="absolute text-white font-bold text-xl sm:text-2xl"
                  style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.8)" }}
                >
                  {correctAnswers}
                </span>
              </div>

              {/* Pause Button */}
              <button
                onClick={() => {
                  playClick();
                  setIsPaused(true);
                }}
                className="relative transition-all duration-300 hover:scale-110 active:scale-95"
                style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.6))" }}
              >
                <img
                  src="/src/pages/spell-the-word/assets/page-2/stone-button.png"
                  alt="Pause"
                  className="w-14 h-14 sm:w-18 sm:h-18"
                />
                <span className="absolute inset-0 flex items-center justify-center text-2xl sm:text-3xl">
                  ⏸️
                </span>
              </button>

              {/* Sound Button */}
              <button
                onClick={() => {
                  playClick();
                  setIsSoundOn(!isSoundOn);
                }}
                className="relative transition-all duration-300 hover:scale-110 active:scale-95"
                style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.6))" }}
              >
                <img
                  src="/src/pages/spell-the-word/assets/page-2/stone-button.png"
                  alt="Sound"
                  className="w-14 h-14 sm:w-18 sm:h-18"
                />
                <span className="absolute inset-0 flex items-center justify-center text-2xl sm:text-3xl">
                  {isSoundOn ? "🔊" : "🔇"}
                </span>
              </button>
            </div>
          </header>

          {/* Main Game Area - Scrollable with hidden scrollbar */}
          <main
            className="relative z-10 flex-1 flex flex-col items-center justify-start px-4 py-2 gap-1 overflow-y-auto scrollbar-hide"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {/* Timer */}
            {timeLeft !== null && (
              <div
                className={`relative flex items-center justify-center transition-transform duration-300 ${
                  timeLeft <= 10 ? "animate-pulse scale-110" : ""
                }`}
                style={{
                  filter:
                    timeLeft <= 10
                      ? "drop-shadow(0 0 20px rgba(255,0,0,0.6))"
                      : "drop-shadow(0 6px 12px rgba(0,0,0,0.6))",
                }}
              >
                <img
                  src="/src/pages/spell-the-word/assets/page-2/timer-button.png"
                  alt="Timer"
                  className={`w-36 h-16 sm:w-44 sm:h-20 transition-all duration-300 ${
                    timeLeft <= 10 ? "brightness-110 hue-rotate-[-15deg]" : ""
                  }`}
                />
                <span
                  className={`absolute inset-0 flex items-center justify-center -translate-y-1 font-bold text-xl sm:text-2xl tracking-widest transition-colors duration-300 ${
                    timeLeft <= 10 ? "text-red-400" : "text-white"
                  }`}
                  style={{
                    textShadow:
                      timeLeft <= 10
                        ? "0 0 10px rgba(255,0,0,0.8), 2px 2px 4px rgba(0,0,0,0.9)"
                        : "2px 2px 4px rgba(0,0,0,0.8)",
                  }}
                >
                  {Math.floor(timeLeft / 60)}:
                  {(timeLeft % 60).toString().padStart(2, "0")}
                </span>
              </div>
            )}

            {/* Image Section with Hint Box and Hint Button */}
            <div className="relative flex items-center justify-center w-full">
              {/* Hint Box - Left side (absolute positioned) */}
              <div className="absolute left-[calc(50%-380px)] sm:left-[calc(50%-400px)] md:left-[calc(50%-450px)] lg:left-[calc(50%-500px)]">
                {currentWord.hint && (
                  <div
                    className="relative flex items-center justify-center"
                    style={{
                      filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.6))",
                    }}
                  >
                    <img
                      src="/src/pages/spell-the-word/assets/page-2/hint-box.png"
                      alt="Hint Box"
                      className="w-44 h-28 sm:w-56 sm:h-36 md:w-64 md:h-40 object-fill"
                    />
                    <div className="absolute inset-0 flex items-center justify-center px-4">
                      <div className="text-center">
                        <span
                          className="text-yellow-300 text-base sm:text-lg font-bold block mb-1"
                          style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.9)" }}
                        >
                          HINT :
                        </span>
                        <span
                          className="text-white text-lg sm:text-xl md:text-2xl font-mono tracking-wider font-bold"
                          style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.9)" }}
                        >
                          {getRevealedHint()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Quiz Image with Stone Border - Center */}
              <div
                className="relative flex items-center justify-center"
                style={{ filter: "drop-shadow(0 8px 20px rgba(0,0,0,0.7))" }}
              >
                {/* Stone Border Frame */}
                <img
                  src="/src/pages/spell-the-word/assets/page-2/image-border.png"
                  alt="Frame"
                  className="w-48 h-40 sm:w-64 sm:h-52 md:w-80 md:h-64 lg:w-96 lg:h-72 object-fill"
                />
                {/* Quiz Image - Centered inside border */}
                <div
                  className="absolute flex items-center justify-center"
                  style={{
                    top: "12%",
                    left: "12%",
                    right: "12%",
                    bottom: "12%",
                  }}
                >
                  {currentWord.word_image ? (
                    <img
                      src={
                        currentWord.word_image.startsWith("http") ||
                        currentWord.word_image.startsWith("data:")
                          ? currentWord.word_image
                          : `${import.meta.env.VITE_API_URL}/${currentWord.word_image}`
                      }
                      alt="Spell this word"
                      className="w-full h-full object-cover rounded-lg"
                      onError={(e) => {
                        e.currentTarget.src =
                          "https://via.placeholder.com/400x300?text=Image";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800 rounded-lg text-slate-400">
                      <span className="text-6xl">🖼️</span>
                    </div>
                  )}
                  {/* Fullscreen Button - Shows on hover */}
                  {currentWord.word_image && (
                    <button
                      onClick={() => setShowImagePopup(true)}
                      className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 transition-all duration-300 rounded-lg group"
                    >
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white text-4xl bg-black/50 rounded-full p-3">
                        🔍
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Hint Button & Audio Button - Right side (absolute positioned) */}
              <div className="absolute right-[calc(50%-260px)] sm:right-[calc(50%-280px)] md:right-[calc(50%-320px)] lg:right-[calc(50%-360px)] flex flex-col items-center gap-2">
                {/* Hint Button */}
                {currentWord.hint && (
                  <button
                    onClick={handleRevealHint}
                    disabled={
                      revealedHintCount >= (currentWord.hint?.length || 0) ||
                      isCorrect ||
                      isWrong
                    }
                    className={`relative transition-all duration-300 ${
                      revealedHintCount >= (currentWord.hint?.length || 0)
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:scale-110 active:scale-95"
                    }`}
                    style={{
                      filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.6))",
                    }}
                  >
                    <img
                      src="/src/pages/spell-the-word/assets/page-2/stone-button.png"
                      alt="Hint"
                      className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24"
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-3xl sm:text-4xl">
                      💡
                    </span>
                  </button>
                )}

                {/* Audio Play Button */}
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
                    className="relative transition-all duration-300 hover:scale-110 active:scale-95"
                    style={{
                      filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.6))",
                    }}
                  >
                    <img
                      src="/src/pages/spell-the-word/assets/page-2/stone-button.png"
                      alt="Play Sound"
                      className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24"
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-3xl sm:text-4xl">
                      🔊
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Answer Slots */}
            <div className="flex flex-wrap justify-center gap-0.5 sm:gap-1.5">
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
            <div
              className={`flex items-center justify-center transition-all duration-200 overflow-hidden ${
                isCorrect || isWrong ? "h-8" : "h-0"
              }`}
            >
              {isCorrect && (
                <div
                  className="text-xl sm:text-2xl font-bold text-green-400 animate-bounce"
                  style={{
                    textShadow:
                      "2px 2px 4px rgba(0,0,0,0.9), 0 0 20px rgba(0,255,0,0.5)",
                  }}
                >
                  ✓ CORRECT!
                </div>
              )}
              {isWrong && (
                <div
                  className="text-xl sm:text-2xl font-bold text-red-400"
                  style={{
                    textShadow:
                      "2px 2px 4px rgba(0,0,0,0.9), 0 0 20px rgba(255,0,0,0.5)",
                  }}
                >
                  ✗ WRONG! ANSWER:{" "}
                  <span className="text-yellow-400">
                    {lastCorrectAnswer.toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Letter Tiles Pool */}
            <div
              className={`
                relative flex flex-wrap justify-center items-center gap-1 sm:gap-1.5 p-2 rounded-2xl max-w-[680px] sm:max-w-[750px] md:max-w-[850px] mx-auto
                transition-all duration-300 ease-out min-h-[60px]
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
                    <span>⬇️</span> DROP HERE TO RETURN LETTER
                  </span>
                </div>
              )}
            </div>

            {/* Submit & Skip Buttons */}
            <div className="flex gap-4 items-center">
              <button
                onClick={handleSubmit}
                disabled={isCorrect || isWrong}
                className={`transition-all duration-300 ${
                  answerSlots.every((s) => s.letter !== null) &&
                  !isCorrect &&
                  !isWrong
                    ? "hover:scale-110 active:scale-95"
                    : "opacity-50 cursor-not-allowed"
                }`}
                style={{ filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.7))" }}
              >
                <img
                  src="/src/pages/spell-the-word/assets/page-2/submit-button.png"
                  alt="Submit"
                  className="w-60 h-[4.5rem] sm:w-72 sm:h-[5.25rem]"
                />
              </button>
              <button
                onClick={handleSkip}
                disabled={isCorrect || isWrong}
                className={`px-6 py-3 rounded-xl font-bold text-sm sm:text-base transition-all duration-200
                  bg-slate-700/80 text-white/90 border-2 border-slate-500
                  ${
                    !isCorrect && !isWrong
                      ? "hover:bg-slate-600 hover:scale-105"
                      : "opacity-50 cursor-not-allowed"
                  }`}
                style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))" }}
              >
                SKIP →
              </button>
            </div>
          </main>
        </div>
      )}

      {/* Fullscreen Image Popup */}
      {showImagePopup && currentWord && currentWord.word_image && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowImagePopup(false)}
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={
                currentWord.word_image.startsWith("http") ||
                currentWord.word_image.startsWith("data:")
                  ? currentWord.word_image
                  : `${import.meta.env.VITE_API_URL}/${currentWord.word_image}`
              }
              alt="Full Image"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            <button
              onClick={() => setShowImagePopup(false)}
              className="absolute -top-4 -right-4 w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xl font-bold shadow-lg transition-all duration-200 hover:scale-110"
            >
              ✕
            </button>
          </div>
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
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default SpellTheWordGame;
