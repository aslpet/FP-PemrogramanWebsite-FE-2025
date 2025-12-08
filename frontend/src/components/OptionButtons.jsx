import React, { useState } from 'react';

export const OptionButtons = ({
  options,
  onSelectOption,
  usedLetters,
  isSubmitted,
}) => {
  const [draggedLetter, setDraggedLetter] = useState(null);

  const handleDragStart = (e, letter) => {
    if (!isSubmitted && !usedLetters.includes(letter)) {
      setDraggedLetter(letter);
      e.dataTransfer.effectAllowed = 'copy';
    }
  };

  const handleDragEnd = () => {
    setDraggedLetter(null);
  };

  const isLetterUsed = (letter) => usedLetters.includes(letter);

  return (
    <div className="flex flex-wrap justify-center gap-3 w-full max-w-2xl">
      {options.map((letter, index) => (
        <button
          key={index}
          draggable={!isSubmitted && !isLetterUsed(letter)}
          onDragStart={(e) => handleDragStart(e, letter)}
          onDragEnd={handleDragEnd}
          onClick={() => !isSubmitted && !isLetterUsed(letter) && onSelectOption(letter)}
          className={`
            w-16 h-16 rounded-lg font-bold text-2xl transition-all duration-200 
            transform hover:scale-110 active:scale-95 shadow-lg
            ${
              isLetterUsed(letter)
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
                : draggedLetter === letter
                ? 'bg-blue-500 text-white scale-110 shadow-2xl'
                : 'bg-gradient-to-b from-gray-200 to-gray-300 text-gray-800 hover:from-gray-300 hover:to-gray-400 cursor-grab active:cursor-grabbing'
            }
          `}
          disabled={isLetterUsed(letter) || isSubmitted}
        >
          {letter}
        </button>
      ))}
    </div>
  );
};
