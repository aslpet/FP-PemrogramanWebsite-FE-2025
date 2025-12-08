import React from 'react';

export const AnswerDisplay = ({ answer, displayLength, onRemoveLetter, onDropLetter, isSubmitted, correctAnswer }) => {
  const dashes = Array(displayLength).fill(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    const letter = e.dataTransfer.getData('text/plain');
    if (letter) {
      onDropLetter(index, letter);
    }
  };

  // ✨ TAMBAHKAN INI - Drag FROM answer box
  const handleDragStart = (e, index) => {
    if (!isSubmitted && answer[index]) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', answer[index]);
      e.dataTransfer.setData('removeIndex', index); // Track index untuk dihapus
    }
  };

  const isCorrect = (index) => {
    return isSubmitted && answer[index] && answer[index] === correctAnswer[index];
  };

  const isWrong = (index) => {
    return isSubmitted && answer[index] && answer[index] !== correctAnswer[index];
  };

  return (
    <div className="flex justify-center gap-2">
      {dashes.map((_, index) => (
        <div
          key={index}
          draggable={!isSubmitted && answer[index]} // ✨ Bisa di-drag jika ada huruf
          onDragStart={(e) => handleDragStart(e, index)} // ✨ TAMBAHKAN
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, index)}
          className={`w-14 h-14 rounded-lg border-4 flex items-center justify-center shadow-lg font-bold text-3xl transition-all duration-200 transform ${
            isWrong(index)
              ? 'bg-red-200 border-red-500 text-red-600'
              : isCorrect(index)
              ? 'bg-green-200 border-green-500 text-green-600'
              : answer[index] 
              ? 'bg-white border-blue-500 text-blue-600 hover:bg-blue-50 cursor-grab active:cursor-grabbing' // ✨ Tambah cursor grab
              : 'bg-white border-blue-500 text-blue-600 hover:bg-blue-50 cursor-pointer hover:scale-105'
          }`}
          onClick={() => answer[index] && onRemoveLetter(index)}
          title={answer[index] ? 'Click to delete or drag back' : 'Drag letter here'} // ✨ Update tooltip
        >
          {answer[index] ? answer[index] : '_'}
        </div>
      ))}
    </div>
  );
};
