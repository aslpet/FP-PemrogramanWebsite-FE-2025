import { QuizContainer } from './components/QuizContainer';
import { quizData } from './data/quizzes';
import './App.css';

function App() {
  return (
    <div className="w-full h-screen">
      <QuizContainer quizzes={quizData} />
    </div>
  );
}

export default App;
