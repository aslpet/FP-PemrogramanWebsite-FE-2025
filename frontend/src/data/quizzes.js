import catImg from '../assets/questions/cat.jpg';
import dogImg from '../assets/questions/dog.jpg';
import elephantImg from '../assets/questions/elephant.jpg';
import giraffeImg from '../assets/questions/giraffe.jpg';
import monkeyImg from '../assets/questions/monkey.jpg';

export const quizData = [
  {
    id: 1,
    question: "What is the name of this animal?",
    image: catImg,
    audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    options: ["C", "A", "T", "S"],
    answer: "CAT",
    displayLength: 3,
  },
  {
    id: 2,
    question: "What animal is this?",
    image: dogImg,
    audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    options: ["D", "O", "G", "E"],
    answer: "DOG",
    displayLength: 3,
  },
  {
    id: 3,
    question: "What animal is this?",
    image: giraffeImg,
    audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    options: ["G", "I", "R", "A", "F", "F", "E"],
    answer: "GIRAFFE",
    displayLength: 7,
  },
  {
    id: 4,
    question: "What is this big animal?",
    image: elephantImg,
    audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    options: ["E", "L", "E", "P", "H", "A", "N", "T"],
    answer: "ELEPHANT",
    displayLength: 8,
  },
  {
    id: 5,
    question: "What animal is this?",
    image: monkeyImg,
    audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    options: ["M", "O", "N", "K", "E", "Y"],
    answer: "MONKEY",
    displayLength: 6,
  },
];
