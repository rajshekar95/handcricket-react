import React, { useState, useCallback, useEffect } from 'react';
import '../styles/HandCricket.css';
import HandGestureDetector from './HandGestureDetector';

const PHASES = {
  USER_BATTING: 'user_batting',
  COMPUTER_BATTING: 'computer_batting',
  GAME_OVER: 'game_over',
};

const HandCricket = () => {
  const [userScore, setUserScore] = useState(0);
  const [computerScore, setComputerScore] = useState(0);
  const [userNumber, setUserNumber] = useState(null);
  const [computerNumber, setComputerNumber] = useState(null);
  const [phase, setPhase] = useState(PHASES.USER_BATTING);
  const [gameStatus, setGameStatus] = useState('start'); // start, playing, finished
  const [message, setMessage] = useState('');
  const [countdown, setCountdown] = useState(null);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [showNumbers, setShowNumbers] = useState(false);
  const [lastGesture, setLastGesture] = useState(null);
  const [targetScore, setTargetScore] = useState(null);
  const [gestureProcessed, setGestureProcessed] = useState(false);

  const generateRandomNumber = () => Math.floor(Math.random() * 5) + 1;

  // Start a new ball with countdown
  const startBall = () => {
    setIsCountingDown(true);
    setCountdown(3);
    setUserNumber(null);
    setComputerNumber(null);
    setLastGesture(null);
    setGestureProcessed(false); // Reset for new ball
  };

  // Handle countdown
  useEffect(() => {
    if (isCountingDown && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (isCountingDown && countdown === 0) {
      setIsCountingDown(false);
      // Do NOT set showNumbers here
      // Wait for gesture to be detected
    }
  }, [isCountingDown, countdown]);

  // Handle gesture detection
  const handleGestureDetected = useCallback((gestureNumber) => {
    if (isCountingDown || showNumbers || gestureProcessed) return; // Only allow after countdown, and only once per ball
    setGestureProcessed(true);
    setLastGesture(gestureNumber);
    if (phase === PHASES.USER_BATTING) {
      // User bats, computer bowls
      const compNum = generateRandomNumber();
      setUserNumber(gestureNumber);
      setComputerNumber(compNum);
      setShowNumbers(true);
      if (gestureNumber === compNum) {
        setMessage('You are OUT! Now bowl to the computer.');
        setTargetScore(userScore);
        setTimeout(() => {
          setPhase(PHASES.COMPUTER_BATTING);
          setMessage('Computer is batting. Try to get it OUT!');
          setShowNumbers(false);
          startBall();
        }, 2000);
      } else {
        setUserScore(prev => prev + gestureNumber);
        setMessage(`You scored ${gestureNumber} run${gestureNumber > 1 ? 's' : ''}!`);
        setTimeout(() => {
          setShowNumbers(false);
          startBall();
        }, 1500);
      }
    } else if (phase === PHASES.COMPUTER_BATTING) {
      // User bowls, computer bats
      const compNum = generateRandomNumber();
      setUserNumber(gestureNumber);
      setComputerNumber(compNum);
      setShowNumbers(true);
      if (gestureNumber === compNum) {
        setMessage('Computer is OUT!');
        setTimeout(() => {
          setPhase(PHASES.GAME_OVER);
          setGameStatus('finished');
          setShowNumbers(false);
        }, 2000);
      } else {
        setComputerScore(prev => prev + compNum);
        setMessage(`Computer scored ${compNum} run${compNum > 1 ? 's' : ''}!`);
        // Check if computer has won
        if (computerScore + compNum > targetScore) {
          setMessage('Computer has won!');
          setTimeout(() => {
            setPhase(PHASES.GAME_OVER);
            setGameStatus('finished');
            setShowNumbers(false);
          }, 2000);
        } else {
          setTimeout(() => {
            setShowNumbers(false);
            startBall();
          }, 1500);
        }
      }
    }
  }, [phase, userScore, computerScore, targetScore, isCountingDown, showNumbers, gestureProcessed]);

  // Start game
  const startGame = () => {
    setUserScore(0);
    setComputerScore(0);
    setUserNumber(null);
    setComputerNumber(null);
    setPhase(PHASES.USER_BATTING);
    setGameStatus('playing');
    setMessage('Your turn to bat! Show 1-5 fingers.');
    setTargetScore(null);
    setShowNumbers(false);
    startBall();
  };

  // Reset game
  const resetGame = () => {
    setUserScore(0);
    setComputerScore(0);
    setUserNumber(null);
    setComputerNumber(null);
    setPhase(PHASES.USER_BATTING);
    setGameStatus('start');
    setMessage('');
    setTargetScore(null);
    setShowNumbers(false);
    setIsCountingDown(false);
    setCountdown(null);
    setLastGesture(null);
  };

  // Render
  return (
    <div className="hand-cricket">
      <h1>Hand Cricket</h1>
      {gameStatus === 'start' && (
        <div className="start-screen">
          <h2>Welcome to Hand Cricket!</h2>
          <div className="game-instructions">
            <h3>How to Play:</h3>
            <ul>
              <li>Show 5 fingers to score runs</li>
              <li>If your number matches the computer's, you're out!</li>
              <li>First innings: Try to score as many runs as possible</li>
              <li>Second innings: Computer will try to chase your score</li>
              <li>If computer scores more than your total, you lose!</li>
            </ul>
          </div>
          <button className="start-button" onClick={startGame}>Start Game</button>
        </div>
      )}
      {gameStatus === 'playing' && (
        <div className="game-area">
          <div className="score-board">
            <div className="score-section">
              <h2>Your Score: {userScore}</h2>
              {phase === PHASES.COMPUTER_BATTING && <h3>Target: {targetScore}</h3>}
            </div>
            <div className="score-section">
              <h2>Computer Score: {computerScore}</h2>
              {phase === PHASES.COMPUTER_BATTING && <h3>Chasing: {targetScore}</h3>}
            </div>
          </div>
          <div className="turn-indicator">
            <h3>
              {phase === PHASES.USER_BATTING && 'Your Turn to Bat!'}
              {phase === PHASES.COMPUTER_BATTING && 'Your Turn to Bowl!'}
            </h3>
          </div>
          {isCountingDown && (
            <div className="countdown">
              <h2>{countdown}</h2>
            </div>
          )}
          {showNumbers && (
            <div className="numbers-display">
              <div className="number-box computer">
                <h3>Computer</h3>
                <div className="number">{computerNumber}</div>
              </div>
              <div className="number-box player">
                <h3>You</h3>
                <div className="number">{userNumber}</div>
              </div>
            </div>
          )}
          <div className="gesture-area">
            <HandGestureDetector 
              onGestureDetected={handleGestureDetected} 
              isActive={gameStatus === 'playing' && !isCountingDown && !showNumbers && phase !== PHASES.GAME_OVER}
            />
            <div className="gesture-instructions">
              <h3>How to Play:</h3>
              <p>Show 1-5 fingers to score runs</p>
              <p>If your number matches the computer's, you're out!</p>
              {phase === PHASES.COMPUTER_BATTING && (
                <p className="computer-turn-message">
                  Computer is batting. Try to get it OUT!
                </p>
              )}
            </div>
          </div>
          {message && <p className="message">{message}</p>}
        </div>
      )}
      {gameStatus === 'finished' && (
        <div className="game-over">
          <h2>Game Over!</h2>
          <p>Your Final Score: {userScore}</p>
          <p>Computer's Final Score: {computerScore}</p>
          <p className="result-message">
            {computerScore > userScore
              ? 'Computer Wins!'
              : computerScore < userScore
                ? 'You Win!'
                : 'It\'s a Tie!'}
          </p>
          <button className="play-again-button" onClick={resetGame}>Play Again</button>
        </div>
      )}
    </div>
  );
};

export default HandCricket; 