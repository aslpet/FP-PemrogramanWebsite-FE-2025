import React from 'react';

export const QuestionImage = ({ src, alt }) => {
  return (
    <div className="w-full flex justify-center">
      <div className="w-64 h-64 bg-white rounded-xl border-8 border-black shadow-2xl overflow-hidden flex items-center justify-center">
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.src = 'https://via.placeholder.com/256?text=Animal';
          }}
        />
      </div>
    </div>
  );
};
