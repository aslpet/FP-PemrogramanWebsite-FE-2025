import React from 'react';

export const AudioButton = ({ onPlay, isPlaying }) => {
  return (
    <button
      onClick={onPlay}
      disabled={isPlaying}
      className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
        isPlaying
          ? 'bg-gray-300 animate-pulse'
          : 'bg-blue-100 hover:bg-blue-200 active:scale-95'
      }`}
      aria-label="Play audio"
    >
      <svg
        className="w-8 h-8 text-blue-600"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M8 5v14l11-7z" />
      </svg>
    </button>
  );
};
