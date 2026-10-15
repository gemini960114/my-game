import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sound } from './utils/sound';
import { launchConfetti } from './utils/confetti';

const CARD_DATA = [
  { type: 'apple', name: '甜蘋果', icon: '🍎', gradient: 'linear-gradient(135deg, #ef4444, #b91c1c)' },
  { type: 'banana', name: '香甜蕉', icon: '🍌', gradient: 'linear-gradient(135deg, #facc15, #ca8a04)' },
  { type: 'grape', name: '紫葡萄', icon: '🍇', gradient: 'linear-gradient(135deg, #a855f7, #6b21a8)' },
  { type: 'strawberry', name: '鮮草莓', icon: '🍓', gradient: 'linear-gradient(135deg, #f43f5e, #be123c)' },
  { type: 'watermelon', name: '多汁西瓜', icon: '🍉', gradient: 'linear-gradient(135deg, #10b981, #059669)' },
  { type: 'orange', name: '蜜香橙', icon: '🍊', gradient: 'linear-gradient(135deg, #fb923c, #ea580c)' },
  { type: 'pineapple', name: '金鑽鳳梨', icon: '🍍', gradient: 'linear-gradient(135deg, #f59e0b, #b45309)' },
  { type: 'cherry', name: '水漾櫻桃', icon: '🍒', gradient: 'linear-gradient(135deg, #ec4899, #9d174d)' },
];


function generateShuffledDeck() {
  const deck = [];
  CARD_DATA.forEach((item) => {
    // Each item appears twice
    deck.push({ ...item, uid: `${item.type}-1` });
    deck.push({ ...item, uid: `${item.type}-2` });
  });

  // Fisher-Yates Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck.map((card, index) => ({
    ...card,
    index,
    isFlipped: false,
    isMatched: false,
  }));
}

export default function App() {
  const [cards, setCards] = useState(() => generateShuffledDeck());
  const [flippedIndexes, setFlippedIndexes] = useState([]);
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [shakingIndexes, setShakingIndexes] = useState([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [bestRecord, setBestRecord] = useState(() => {
    try {
      const saved = localStorage.getItem('memory_game_best');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const canvasRef = useRef(null);
  const confettiCleanupRef = useRef(null);

  // Timer Effect
  useEffect(() => {
    let interval = null;
    if (isTimerRunning && !isCompleted) {
      interval = setInterval(() => {
        setTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, isCompleted]);

  // Restart / Reset Game
  const resetGame = useCallback(() => {
    if (confettiCleanupRef.current) {
      confettiCleanupRef.current();
      confettiCleanupRef.current = null;
    }
    setCards(generateShuffledDeck());
    setFlippedIndexes([]);
    setMoves(0);
    setTime(0);
    setIsTimerRunning(false);
    setIsLocked(false);
    setShakingIndexes([]);
    setIsCompleted(false);
    setIsNewRecord(false);
  }, []);

  // Handle Card Click
  const handleCardClick = (index) => {
    const card = cards[index];
    if (isLocked || card.isFlipped || card.isMatched) {
      return;
    }

    // Start timer on first card action
    if (!isTimerRunning) {
      setIsTimerRunning(true);
    }

    sound.playFlip();

    const newCards = [...cards];
    newCards[index] = { ...card, isFlipped: true };
    setCards(newCards);

    const newFlipped = [...flippedIndexes, index];
    setFlippedIndexes(newFlipped);

    // If second card flipped, check match
    if (newFlipped.length === 2) {
      const [firstIdx, secondIdx] = newFlipped;
      const firstCard = newCards[firstIdx];
      const secondCard = newCards[secondIdx];

      setMoves((prev) => prev + 1);
      setIsLocked(true);

      if (firstCard.type === secondCard.type) {
        // MATCH SUCCESS
        setTimeout(() => {
          sound.playMatch();
          setCards((prev) =>
            prev.map((c, idx) =>
              idx === firstIdx || idx === secondIdx
                ? { ...c, isMatched: true, isFlipped: true }
                : c
            )
          );
          setFlippedIndexes([]);
          setIsLocked(false);
        }, 350);
      } else {
        // MISMATCH
        setTimeout(() => {
          sound.playMismatch();
          setShakingIndexes([firstIdx, secondIdx]);

          setTimeout(() => {
            setCards((prev) =>
              prev.map((c, idx) =>
                idx === firstIdx || idx === secondIdx
                  ? { ...c, isFlipped: false }
                  : c
              )
            );
            setFlippedIndexes([]);
            setShakingIndexes([]);
            setIsLocked(false);
          }, 650);
        }, 500);
      }
    }
  };

  // Check Game Completion
  useEffect(() => {
    const matchedCount = cards.filter((c) => c.isMatched).length;
    if (matchedCount === 16 && cards.length === 16 && !isCompleted) {
      setIsCompleted(true);
      setIsTimerRunning(false);
      sound.playWin();

      // Check record
      let isRecord = false;
      if (!bestRecord || moves < bestRecord.moves || (moves === bestRecord.moves && time < bestRecord.time)) {
        isRecord = true;
        setIsNewRecord(true);
        const recordData = { moves, time };
        setBestRecord(recordData);
        try {
          localStorage.setItem('memory_game_best', JSON.stringify(recordData));
        } catch {
          // Ignore storage quota errors
        }
      }

      // Launch Confetti Celebration
      if (canvasRef.current) {
        confettiCleanupRef.current = launchConfetti(canvasRef.current);
      }
    }
  }, [cards, isCompleted, moves, time, bestRecord]);

  // Clean up confetti on unmount
  useEffect(() => {
    return () => {
      if (confettiCleanupRef.current) {
        confettiCleanupRef.current();
      }
    };
  }, []);

  const toggleSound = () => {
    const nextState = sound.toggleSound();
    setSoundOn(nextState);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const matchedPairs = cards.filter((c) => c.isMatched).length / 2;

  // Star rating calculation
  const getStars = () => {
    if (moves <= 12) return 3;
    if (moves <= 18) return 2;
    return 1;
  };

  return (
    <div className="game-container">
      {/* Ambient background lighting */}
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />

      {/* Header */}
      <header className="game-header">
        <h1 className="game-title">
          <span>🍓</span> 水果記憶翻牌
        </h1>
        <p className="game-subtitle">翻開相同的水果卡牌即可消除，挑戰最高評分！</p>
      </header>

      {/* Stats Bar */}
      <section className="stats-panel" aria-label="遊戲數據">
        <div className="stat-card" id="stat-time">
          <div className="stat-label">⏱️ 計時</div>
          <div className="stat-value highlight">{formatTime(time)}</div>
        </div>

        <div className="stat-card" id="stat-moves">
          <div className="stat-label">👣 步數</div>
          <div className="stat-value">{moves} 步</div>
        </div>

        <div className="stat-card" id="stat-matches">
          <div className="stat-label">🎯 配對</div>
          <div className="stat-value">{matchedPairs} / 8</div>
        </div>

        <div className="stat-card" id="stat-record">
          <div className="stat-label">🏆 最佳</div>
          <div className="stat-value">
            {bestRecord ? `${bestRecord.moves}步` : '--'}
          </div>
        </div>
      </section>

      {/* Controls Bar */}
      <div className="controls-panel">
        <button
          type="button"
          className="btn-primary"
          id="btn-restart"
          onClick={resetGame}
        >
          <span>🔄</span> 重新開始
        </button>

        <button
          type="button"
          className="btn-icon"
          id="btn-sound-toggle"
          onClick={toggleSound}
          title={soundOn ? '點擊靜音' : '點擊開啟音效'}
        >
          <span>{soundOn ? '🔊' : '🔇'}</span>
          <span>{soundOn ? '音效已開啟' : '靜音中'}</span>
        </button>
      </div>

      {/* 4x4 Grid Board (16 cards) */}
      <main className="grid-board" id="game-board">
        {cards.map((card, idx) => {
          const isFlipped = card.isFlipped || card.isMatched;
          const isShaking = shakingIndexes.includes(idx);
          const isMatched = card.isMatched;

          return (
            <div
              key={card.uid}
              id={`card-${idx}`}
              className={`card-wrapper ${isFlipped ? 'flipped' : ''} ${isMatched ? 'matched' : ''} ${isShaking ? 'shake' : ''}`}
              onClick={() => handleCardClick(idx)}
              role="button"
              tabIndex={0}
              aria-label={`卡片 ${idx + 1}: ${isFlipped ? card.name : '未翻開'}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleCardClick(idx);
                }
              }}
            >
              <div className="card-inner">
                {/* Card Back */}
                <div className="card-face card-back">
                  <div className="card-back-pattern">
                    <span className="card-back-icon">✨</span>
                  </div>
                </div>

                {/* Card Front */}
                <div
                  className="card-face card-front"
                  style={{ background: card.gradient }}
                >
                  <span className="card-icon">{card.icon}</span>
                  <span className="card-name">{card.name}</span>
                  {isMatched && <div className="matched-badge">✓</div>}
                </div>
              </div>
            </div>
          );
        })}
      </main>

      {/* Victory Celebration Modal */}
      {isCompleted && (
        <div className="modal-overlay" id="victory-modal">
          <div className="victory-card">
            <div className="victory-trophy">🎉</div>
            <h2 className="victory-title">太棒了！已全部消除完成</h2>
            <p className="victory-subtitle">恭喜你成功配對所有水果卡牌！</p>

            {isNewRecord && (
              <div className="new-record-pill">
                <span>🌟</span> 突破個人最佳紀錄！
              </div>
            )}

            <div className="stars-container">
              {Array.from({ length: 3 }).map((_, i) => (
                <span
                  key={i}
                  className="star-icon"
                  style={{
                    filter: i < getStars() ? 'none' : 'grayscale(100%) opacity(30%)',
                    animationDelay: `${i * 0.15}s`
                  }}
                >
                  ⭐
                </span>
              ))}
            </div>

            <div className="victory-summary-grid">
              <div className="summary-box">
                <div className="summary-box-label">總共用時</div>
                <div className="summary-box-val">{formatTime(time)}</div>
              </div>
              <div className="summary-box">
                <div className="summary-box-label">總消耗步數</div>
                <div className="summary-box-val">{moves} 步</div>
              </div>
            </div>

            <button
              type="button"
              className="btn-restart-large"
              id="btn-play-again"
              onClick={resetGame}
            >
              <span>🔄</span> 再玩一次
            </button>
          </div>
        </div>
      )}

      {/* Confetti Canvas for Victory */}
      <canvas ref={canvasRef} className="confetti-canvas" />
    </div>
  );
}
