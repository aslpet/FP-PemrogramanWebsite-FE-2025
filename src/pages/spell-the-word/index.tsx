import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/api/axios";

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
      audioContextRef.current = new (window.AudioContext ||
        (window as Window & { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
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
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("letterIndex", index.toString());
    e.dataTransfer.setData("letter", letter);
    e.dataTransfer.setData("source", "pool");
    onDragStart(index, letter);
  };

  return (
    <button
      onClick={onClick}
      disabled={isUsed}
      draggable={!isUsed}
      onDragStart={handleDragStart}
      className={`
        relative w-14 h-14 sm:w-16 sm:h-16
        rounded-xl font-bold text-2xl sm:text-3xl
        transition-all duration-200 transform select-none
        ${
          isUsed
            ? "opacity-20 scale-90 bg-slate-600/50 text-slate-500 cursor-not-allowed"
            : "bg-gradient-to-b from-cyan-400 to-cyan-600 text-white shadow-lg hover:scale-105 hover:shadow-xl cursor-grab active:cursor-grabbing active:scale-95 border-b-4 border-cyan-700"
        }
      `}
      style={{ textShadow: isUsed ? "none" : "0 2px 4px rgba(0,0,0,0.3)" }}
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
}) => {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const letterIndex = parseInt(e.dataTransfer.getData("letterIndex"));
    const droppedLetter = e.dataTransfer.getData("letter");
    const source = e.dataTransfer.getData("source") || "pool";
    onDrop(slotIndex, letterIndex, droppedLetter, source);
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (!letter) return;
    e.dataTransfer.setData("slotIndex", slotIndex.toString());
    e.dataTransfer.setData("letter", letter);
    e.dataTransfer.setData("source", "slot");
    onDragStart(slotIndex);
  };

  return (
    <div
      onClick={onClick}
      onDrop={handleDrop}
      onDragOver={onDragOver}
      draggable={!!letter && !isCorrect && !isWrong}
      onDragStart={handleDragStart}
      className={`
        w-12 h-14 sm:w-14 sm:h-16
        rounded-lg font-bold text-2xl sm:text-3xl
        transition-all duration-200 transform
        flex items-center justify-center
        ${
          letter
            ? isCorrect
              ? "bg-gradient-to-b from-green-400 to-green-600 text-white border-b-4 border-green-700 shadow-lg"
              : isWrong
                ? "bg-gradient-to-b from-red-400 to-red-600 text-white border-b-4 border-red-700 shadow-lg animate-shake"
                : "bg-gradient-to-b from-slate-100 to-slate-200 text-slate-800 border-b-4 border-slate-300 shadow-md cursor-grab hover:scale-105"
            : isSelected
              ? "bg-cyan-500/30 border-2 border-cyan-400"
              : "bg-slate-700/30 border-2 border-dashed border-slate-400/50"
        }
      `}
    >
      {letter ? (
        <span
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
        <span className="text-slate-500/50">_</span>
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
}: {
  gameName: string;
  gameDescription: string;
  onStart: () => void;
  onEnableAudio?: () => void;
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
          className="group relative flex items-center justify-center px-12 py-4 bg-gradient-to-b from-amber-400 to-amber-600 rounded-2xl hover:scale-110 transition-all duration-300 shadow-xl hover:shadow-2xl mx-auto border-b-4 border-amber-700"
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
}: {
  result: GameResult;
  onPlayAgain: () => void;
  onExit: () => void;
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
      className="absolute inset-0 z-[200] flex items-center justify-center"
      style={{
        background:
          "linear-gradient(180deg, #87CEEB 0%, #1E90FF 50%, #006994 100%)",
      }}
    >
      <div className="bg-white/20 backdrop-blur-md rounded-3xl p-8 mx-4 text-center max-w-md w-full space-y-4 border border-white/30 shadow-2xl">
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
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [timer, setTimer] = useState(0);
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

  // Settings
  const [isSoundOn, setIsSoundOn] = useState(true);
  const { playCorrect, playWrong, playClick, playSuccess, playLetterPlace } =
    useSoundEffects(isSoundOn);

  // Refs
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch Game Data
  useEffect(() => {
    const fetchGame = async () => {
      try {
        setIsLoading(true);
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
        letters = shuffleArray(demoCorrectWords[wordIndex].split(""));
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
    },
    [gameData, demoCorrectWords],
  );

  // Start game
  const handleStart = () => {
    setGameState("playing");
    setCurrentWordIndex(0);
    setCorrectAnswers(0);
    setScore(0);
    setTimer(0);
    setTotalTime(0);
    initializeWord(0);
  };

  // Timer effect
  useEffect(() => {
    if (gameState === "playing" && !isPaused && !isCorrect && !isWrong) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => prev + 1);
        setTotalTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, isPaused, isCorrect, isWrong]);

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
        if (letterIndex !== -1 && selectedSlot < answerSlots.length) {
          placeLetter(selectedSlot, letterIndex, shuffledLetters[letterIndex]);
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
    if (selectedSlot < answerSlots.length) {
      placeLetter(selectedSlot, index, shuffledLetters[index]);
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

  // Handle slot drag start (for returning to pool via failed drop)
  const handleSlotDragStart = () => {
    // When drag ends outside valid area, letter returns to pool
    const handleDragEnd = () => {
      // If dropped outside, letter stays (browser handles this)
      document.removeEventListener("dragend", handleDragEnd);
    };
    document.addEventListener("dragend", handleDragEnd);
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
        setCorrectAnswers((prev) => prev + 1);
        setScore((prev) => prev + (gameData.score_per_word || 100));
        setTimeout(() => moveToNextWord(), 1200);
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
        setCorrectAnswers((prev) => prev + 1);
        setScore((prev) => prev + (gameData.score_per_word || 100));
        setTimeout(() => moveToNextWord(), 1200);
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
      setTimer(0);
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
    const finalCorrect = correctAnswers + (isCorrect ? 1 : 0);
    const maxScore = totalWords * (gameData.score_per_word || 100);
    const finalScore = score + (isCorrect ? gameData.score_per_word || 100 : 0);
    const percentage = Math.round((finalCorrect / totalWords) * 100);

    setResult({
      correct_words: finalCorrect,
      total_words: totalWords,
      max_score: maxScore,
      score: finalScore,
      percentage: percentage,
      time_taken: totalTime,
    });

    setGameState("finished");
    playSuccess();
  };

  // Exit
  const handleExit = async () => {
    try {
      await api.post("/api/game/play-count", { game_id: id });
    } catch (err) {
      console.error("Failed to update play count:", err);
    }
    navigate("/");
  };

  // Play again
  const handlePlayAgain = () => {
    setGameState("intro");
    setResult(null);
    setCurrentWordIndex(0);
    setCorrectAnswers(0);
    setScore(0);
    setTimer(0);
    setTotalTime(0);
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

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
          onEnableAudio={() => setIsSoundOn(true)}
        />
      )}

      {/* Pause Overlay */}
      {isPaused && gameState === "playing" && (
        <PauseOverlay onResume={() => setIsPaused(false)} />
      )}

      {/* Result Screen */}
      {gameState === "finished" && result && (
        <ResultScreen
          result={result}
          onPlayAgain={handlePlayAgain}
          onExit={handleExit}
        />
      )}

      {/* Game UI */}
      {gameState === "playing" && (
        <div className="flex flex-col h-screen">
          {/* Header */}
          <header className="bg-black/20 backdrop-blur-sm px-4 py-3 flex items-center justify-between">
            <button
              onClick={handleExit}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
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

            <div className="flex items-center gap-3 text-white">
              <span className="font-bold text-lg">
                {currentWordIndex + 1} of {gameData.words.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-white flex items-center gap-1">
                <span className="text-green-300">✓</span>
                <span className="font-bold">{correctAnswers}</span>
              </div>

              <div className="flex items-center gap-2">
                {currentWord.word_audio && (
                  <button
                    onClick={() => {
                      const audio = new Audio(currentWord.word_audio!);
                      audio.play();
                    }}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                  >
                    🔊
                  </button>
                )}
                <button
                  onClick={() => setIsPaused(true)}
                  className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
                >
                  ⏸️
                </button>
                <button
                  onClick={() => setIsSoundOn(!isSoundOn)}
                  className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
                >
                  {isSoundOn ? "🔊" : "🔇"}
                </button>
              </div>
            </div>
          </header>

          {/* Main Game Area */}
          <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-6">
            {/* Image */}
            <div className="w-64 h-48 sm:w-80 sm:h-60 md:w-96 md:h-72 rounded-xl overflow-hidden bg-white shadow-2xl border-4 border-white">
              {currentWord.word_image ? (
                <img
                  src={
                    currentWord.word_image.startsWith("http")
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

            {/* Hint */}
            {currentWord.hint && (
              <div className="text-white/90 text-lg text-center">
                <span className="text-cyan-200">Hint:</span> {currentWord.hint}
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

            {/* Letter Tiles */}
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3 max-w-lg">
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

            <div className="text-white/60 font-mono text-sm">
              Time: {formatTime(timer)}
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
