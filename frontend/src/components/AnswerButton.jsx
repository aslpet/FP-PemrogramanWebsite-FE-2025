import React from 'react';

export const AnswerButton = ({ letter, onClick, isSelected, isCorrect, isWrong }) => {
  let buttonClass =
    'w-20 h-20 rounded-xl text-3xl font-bold transition-all duration-200 shadow-xl active:scale-95 cursor-pointer ';

  if (isSelected) {
    if (isCorrect) {
      buttonClass += 'bg-green-500 text-white scale-110 shadow-2xl';
    } else if (isWrong) {
      buttonClass += 'bg-red-500 text-white scale-105';
    } else {
      buttonClass += 'bg-blue-600 text-white scale-105 shadow-xl';
    }
  } else {
    buttonClass += 'bg-gray-200 text-gray-800 hover:bg-gray-300 border-2 border-gray-400';
  }

  return (
    <button
      onClick={() => onClick(letter)}
      className={buttonClass}
      disabled={isWrong}
    >
      {letter}
    </button>
  );
};
