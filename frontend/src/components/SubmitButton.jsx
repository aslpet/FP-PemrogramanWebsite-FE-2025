import React from 'react';

export const SubmitButton = ({ onClick, disabled, isSubmitted }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-12 py-3 rounded-xl font-bold text-lg transition-all duration-300 shadow-xl transform ${
        disabled
          ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-50'
          : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 active:scale-95 shadow-2xl hover:scale-105'
      }`}
    >
      {isSubmitted ? '✓ Submitted' : '✓ Submit'}
    </button>
  );
};
