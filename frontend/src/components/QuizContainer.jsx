import React, { useState, useEffect } from 'react';
import { QuizHeader } from './QuizHeader';
import { AudioButton } from './AudioButton';
import { QuestionImage } from './QuestionImage';
import { AnswerDisplay } from './AnswerDisplay';
import { KeyboardLayout } from './KeyboardLayout';
import { SubmitButton } from './SubmitButton';

export const QuizContainer = ({ quizzes }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const contentRef = React.useRef(null);

  const currentQuiz = quizzes[currentQuestionIndex];
  const totalQuestions = quizzes.length;

  // Auto-scroll to bottom when submitted
  useEffect(() => {
    if (isSubmitted && contentRef.current) {
      setTimeout(() => {
        contentRef.current.scrollTop = contentRef.current.scrollHeight;
      }, 100);
    }
  }, [isSubmitted]);

  // Keyboard support
  useEffect(() => {
    const handleKeyPress = (e) => {
      const key = e.key.toUpperCase();
      
      if (e.key === 'Enter') {
        handleSubmit();
        return;
      }

      if (e.key === 'Backspace') {
        handleRemoveLastLetter();
        return;
      }

      // Allow all alphabet keys
      if (!isSubmitted && /^[A-Z]$/.test(key)) {
        if (selectedAnswers.length < currentQuiz.displayLength) {
          setSelectedAnswers([
            ...selectedAnswers,
            { letter: key, position: selectedAnswers.length }
          ]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedAnswers, isSubmitted, currentQuiz]);

  const getUsedLetters = () => {
    return selectedAnswers.map(item => item.letter);
  };

  const handleSelectOption = (letter) => {
    if (!isSubmitted && selectedAnswers.length < currentQuiz.displayLength) {
      setSelectedAnswers([
        ...selectedAnswers,
        { letter, position: selectedAnswers.length }
      ]);
    }
  };

  const handleDropLetter = (index, letter) => {
    if (!isSubmitted) {
      const newAnswers = [...selectedAnswers];
      newAnswers[index] = { letter, position: index };
      setSelectedAnswers(newAnswers);
    }
  };

  const handleRemoveLetter = (index) => {
    if (!isSubmitted) {
      const newAnswers = selectedAnswers.filter((_, i) => i !== index);
      setSelectedAnswers(newAnswers);
    }
  };

  const handleRemoveLastLetter = () => {
    if (!isSubmitted && selectedAnswers.length > 0) {
      setSelectedAnswers(selectedAnswers.slice(0, -1));
    }
  };

  const handleReturnLetter = (index) => {
  if (!isSubmitted) {
    handleRemoveLetter(index); // Reuse existing function
  }
};

  const handlePlayAudio = () => {
    setIsPlaying(true);
    setTimeout(() => setIsPlaying(false), 2000);
  };

  const handleSubmit = () => {
    const answer = selectedAnswers.map(item => item.letter).join('');
    if (answer.length === currentQuiz.displayLength) {
      setIsSubmitted(true);
      if (answer === currentQuiz.answer) {
        // Correct answer - show green boxes, then auto advance
        setScore(score + 1);
        setTimeout(() => {
          if (currentQuestionIndex < totalQuestions - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
            setSelectedAnswers([]);
            setIsSubmitted(false);
          } else {
            alert(`Quiz Complete! Score: ${score + 1}/${totalQuestions}`);
            setCurrentQuestionIndex(0);
            setScore(0);
            setSelectedAnswers([]);
            setIsSubmitted(false);
          }
        }, 1500);
      } else {
        // Wrong answer - reset and show message, stay on page
        setTimeout(() => {
          setSelectedAnswers([]);
          setIsSubmitted(false);
        }, 2000);
      }
    }
  };

  const answerArray = Array(currentQuiz.displayLength).fill(null).map((_, i) => {
    const item = selectedAnswers.find(a => a.position === i);
    return item ? item.letter : '';
  });

  return (
    <div className="h-screen bg-gradient-to-b from-blue-500 to-blue-300 flex flex-col overflow-hidden">
      <QuizHeader currentQuestion={currentQuestionIndex + 1} totalQuestions={totalQuestions} />

      <div className="flex-1 flex flex-col items-center p-3 overflow-y-auto" ref={contentRef}>
        {/* Audio Button */}
        <div className="pt-1">
          <AudioButton onPlay={handlePlayAudio} isPlaying={isPlaying} />
        </div>

        {/* Question Image */}
        <div className="w-full flex justify-center py-2">
          <QuestionImage src={currentQuiz.image} alt="Question" />
        </div>

        {/* Answer Display */}
        <div className="w-full flex justify-center py-3">
          <AnswerDisplay
            answer={answerArray}
            displayLength={currentQuiz.displayLength}
            onRemoveLetter={handleRemoveLetter}
            onDropLetter={handleDropLetter}
            isSubmitted={isSubmitted}
            correctAnswer={currentQuiz.answer.split('')}
          />
        </div>

        {/* Feedback */}
        {isSubmitted && (
          <div className="py-2 text-center">
            {selectedAnswers.map(item => item.letter).join('') === currentQuiz.answer ? (
              <p className="text-2xl font-bold text-green-300 drop-shadow-lg">Correct!</p>
            ) : (
              <p className="text-2xl font-bold text-red-300 drop-shadow-lg">Wrong! Try again.</p>
            )}
          </div>
        )}

        {/* Keyboard Layout - Full QWERTY */}
        <div className="w-full flex justify-center py-3">
          <KeyboardLayout
            onSelectOption={handleSelectOption}
            usedLetters={getUsedLetters()}
            isSubmitted={isSubmitted}
            onReturnLetter={handleReturnLetter}
          />
        </div>

        {/* Submit Button */}
        <div className="w-full flex justify-center py-4 pb-6">
          <SubmitButton
            onClick={handleSubmit}
            disabled={!isSubmitted && selectedAnswers.length === 0}
            isSubmitted={isSubmitted}
          />
        </div>
      </div>

      <div className="bg-black bg-opacity-30 text-white text-center py-2 font-bold text-xs flex-shrink-0">
        Score: {score}/{totalQuestions}
      </div>
    </div>
  );
};
