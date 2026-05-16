'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import styles from './HackTerminal.module.css';

/* ══════════════════════════════════════════════════════════════════════════
   Types & Constants
   ══════════════════════════════════════════════════════════════════════════ */

interface HackTerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  difficulty: 'easy' | 'medium' | 'hard';
  onSuccess: () => void;
}

/** Cyber-themed 5-letter word pool */
const WORD_POOL: string[] = [
  'PROXY', 'VIRUS', 'NODES', 'CRACK', 'BLOCK',
  'VAULT', 'BYTES', 'CHAIN', 'PATCH', 'STACK',
  'PORTS', 'ROUTE', 'SHELL', 'LOGIC', 'CRYPT',
  'SHARD', 'FORGE', 'ARRAY', 'INDEX', 'QUEUE',
  'SCOPE', 'LAYER', 'TOKEN', 'GUARD', 'PARSE',
];

const DIFFICULTY_WORD_COUNT: Record<HackTerminalModalProps['difficulty'], number> = {
  easy:   6,
  medium: 10,
  hard:   15,
};

const MAX_ATTEMPTS = 3;

/** Hex character set for filler */
const HEX_CHARS = '0123456789ABCDEF';

/* ══════════════════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════════════════ */

/** Generate a random hex token like `0x4F2A` */
function randomHex(): string {
  let hex = '0x';
  for (let i = 0; i < 4; i++) {
    hex += HEX_CHARS[Math.floor(Math.random() * 16)];
  }
  return hex;
}

/** Fisher-Yates shuffle */
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick N random items from pool without repetition */
function pickRandom<T>(pool: T[], n: number): T[] {
  return shuffleArray(pool).slice(0, n);
}

/* ══════════════════════════════════════════════════════════════════════════
   Memory Dump Generator
   
   Creates a Fallout-style hex dump with clickable words embedded between
   random hex tokens. Each "line" starts with a memory address, followed
   by a mix of hex noise and interleaved words.
   ══════════════════════════════════════════════════════════════════════════ */

interface DumpToken {
  type: 'hex' | 'word' | 'addr' | 'bracket';
  value: string;
}

function generateMemoryDump(words: string[]): DumpToken[] {
  const tokens: DumpToken[] = [];
  const totalLines = 20;
  const wordsPerLine = Math.ceil(words.length / totalLines);

  // Distribute words across lines
  const wordQueue = [...words];
  let baseAddr = 0xF000 + Math.floor(Math.random() * 0x0FFF);

  const brackets = ['()', '{}', '[]', '<>', '%%', '##', '@@', '$$', '!!', '**'];

  for (let line = 0; line < totalLines; line++) {
    // Memory address prefix
    tokens.push({ type: 'addr', value: `0x${baseAddr.toString(16).toUpperCase()}` });
    baseAddr += 0x0010;

    // Generate line content: mix of hex and words
    const lineWordsCount = Math.min(
      wordsPerLine,
      wordQueue.length,
      1 + Math.floor(Math.random() * 2),
    );

    // Determine positions for words in this line
    const segments = 4 + Math.floor(Math.random() * 3); // 4-6 segments per line
    const wordPositions = new Set<number>();
    while (wordPositions.size < lineWordsCount && wordQueue.length > 0) {
      wordPositions.add(Math.floor(Math.random() * segments));
    }

    for (let seg = 0; seg < segments; seg++) {
      if (wordPositions.has(seg) && wordQueue.length > 0) {
        tokens.push({ type: 'word', value: wordQueue.shift()! });
      } else {
        // Random filler: hex or bracket noise
        if (Math.random() < 0.7) {
          tokens.push({ type: 'hex', value: randomHex() });
        } else {
          tokens.push({
            type: 'bracket',
            value: brackets[Math.floor(Math.random() * brackets.length)],
          });
        }
      }
      // Inter-segment separator
      if (seg < segments - 1) {
        tokens.push({ type: 'hex', value: ' ' });
      }
    }

    // Line break (rendered as space in the dump)
    tokens.push({ type: 'hex', value: '\n' });
  }

  return tokens;
}

/* ══════════════════════════════════════════════════════════════════════════
   Log Entry Type
   ══════════════════════════════════════════════════════════════════════════ */

interface LogEntry {
  id: number;
  text: string;
  type: 'info' | 'denied' | 'success' | 'lockout' | 'hint';
}

/* ══════════════════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════════════════ */

export default function HackTerminalModal({
  isOpen,
  onClose,
  difficulty,
  onSuccess,
}: HackTerminalModalProps) {
  /* ── Core State ───────────────────────────────────────────────────────── */
  const [attempts, setAttempts] = useState(MAX_ATTEMPTS);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [terminalState, setTerminalState] = useState<'active' | 'granted' | 'lockout'>('active');
  const logIdRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  /* ── Generate puzzle on mount / difficulty change ─────────────────────── */
  const wordCount = DIFFICULTY_WORD_COUNT[difficulty];

  const { words, correctWord, dumpTokens } = useMemo(() => {
    const selected = pickRandom(WORD_POOL, wordCount);
    const correct = selected[Math.floor(Math.random() * selected.length)];
    const dump = generateMemoryDump(selected);
    return { words: selected, correctWord: correct, dumpTokens: dump };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, difficulty]);

  /* ── Reset state when modal opens ────────────────────────────────────── */
  useEffect(() => {
    if (isOpen) {
      setAttempts(MAX_ATTEMPTS);
      setLogs([
        { id: 0, text: 'ROBCO INDUSTRIES (TM) TERMLINK PROTOCOL', type: 'info' },
        { id: 1, text: `ENTER PASSWORD NOW. ${MAX_ATTEMPTS} ATTEMPT(S) LEFT.`, type: 'info' },
        { id: 2, text: `DIFFICULTY: ${difficulty.toUpperCase()} — ${wordCount} CANDIDATES`, type: 'info' },
      ]);
      logIdRef.current = 3;
      setUsedWords(new Set());
      setTerminalState('active');
    }
  }, [isOpen, difficulty, wordCount]);

  /* ── Auto-scroll log ─────────────────────────────────────────────────── */
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  /* ── Add log helper ──────────────────────────────────────────────────── */
  const addLog = useCallback((text: string, type: LogEntry['type']) => {
    const id = logIdRef.current++;
    setLogs((prev) => [...prev, { id, text, type }]);
  }, []);

  /* ── Compute letter match hint ───────────────────────────────────────── */
  const getMatchCount = useCallback(
    (guess: string): number => {
      let count = 0;
      for (let i = 0; i < guess.length; i++) {
        if (guess[i] === correctWord[i]) count++;
      }
      return count;
    },
    [correctWord],
  );

  /* ── Word Click Handler ──────────────────────────────────────────────── */
  const handleWordClick = useCallback(
    (word: string) => {
      if (terminalState !== 'active') return;
      if (usedWords.has(word)) return;

      // Mark word as used
      setUsedWords((prev) => new Set(prev).add(word));

      if (word === correctWord) {
        /* ── SUCCESS ── */
        addLog(`> ${word}`, 'info');
        addLog('ACCESS GRANTED. INITIATING SMART CONTRACT...', 'success');
        setTerminalState('granted');

        // Fire onSuccess after dramatic pause
        setTimeout(() => {
          onSuccess();
        }, 2000);
      } else {
        /* ── WRONG ── */
        const remaining = attempts - 1;
        const matchCount = getMatchCount(word);
        setAttempts(remaining);

        addLog(`> ${word}`, 'info');
        addLog('ACCESS DENIED.', 'denied');
        addLog(`${matchCount}/5 correct.`, 'hint');

        if (remaining <= 0) {
          /* ── LOCKOUT ── */
          addLog('SYSTEM LOCKOUT — TERMINAL LOCKED.', 'lockout');
          setTerminalState('lockout');

          setTimeout(() => {
            onClose();
          }, 2500);
        } else {
          addLog(`${remaining} ATTEMPT(S) REMAINING.`, 'info');
        }
      }
    },
    [terminalState, usedWords, correctWord, attempts, addLog, getMatchCount, onClose, onSuccess],
  );

  /* ── ESC key to close ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && terminalState === 'active') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose, terminalState]);

  /* ── Early return ────────────────────────────────────────────────────── */
  if (!isOpen) return null;

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className={styles.overlay} onClick={() => terminalState === 'active' && onClose()}>
      <div className={styles.terminal} onClick={(e) => e.stopPropagation()}>

        {/* Close button */}
        <button
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close terminal"
        >
          ×
        </button>

        {/* ── Header ── */}
        <div className={styles.header}>
          <span className={styles.headerTitle}>◈ HACK TERMINAL v2.7.1</span>
          <span className={styles.headerAttempts}>
            ATTEMPTS{' '}
            {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
              <span
                key={i}
                className={`${styles.attemptDot} ${
                  i < attempts ? styles.attemptDotActive : styles.attemptDotUsed
                }`}
              />
            ))}
          </span>
        </div>

        {/* ── Memory Dump Body ── */}
        <div className={styles.body}>
          <div className={styles.memoryDump}>
            {dumpTokens.map((token, idx) => {
              if (token.type === 'addr') {
                return (
                  <span key={idx} className={styles.hexChar} style={{ color: 'rgba(32,255,77,0.45)', marginRight: 8 }}>
                    {token.value}
                  </span>
                );
              }

              if (token.type === 'word') {
                const isUsed = usedWords.has(token.value);
                return (
                  <span
                    key={idx}
                    className={`${styles.word} ${isUsed ? styles.wordUsed : ''}`}
                    onClick={() => handleWordClick(token.value)}
                    role="button"
                    tabIndex={isUsed ? -1 : 0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleWordClick(token.value);
                    }}
                  >
                    {token.value}
                  </span>
                );
              }

              if (token.value === '\n') {
                return <br key={idx} />;
              }

              // hex or bracket noise
              return (
                <span key={idx} className={styles.hexChar}>
                  {token.value}
                </span>
              );
            })}
          </div>
        </div>

        {/* ── Output Log ── */}
        <div className={styles.outputLog}>
          {logs.map((entry) => (
            <div
              key={entry.id}
              className={`${styles.logLine} ${
                entry.type === 'success'
                  ? styles.logSuccess
                  : entry.type === 'denied'
                  ? styles.logDenied
                  : entry.type === 'lockout'
                  ? styles.logLockout
                  : entry.type === 'hint'
                  ? styles.logInfo
                  : styles.logPrompt
              }`}
            >
              {entry.text}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>

        {/* ── Access Granted Overlay ── */}
        {terminalState === 'granted' && (
          <div className={styles.grantedOverlay}>
            <div className={styles.grantedText}>ACCESS GRANTED</div>
            <div className={styles.grantedSubtext}>
              INITIATING SMART CONTRACT CALL...
            </div>
          </div>
        )}

        {/* ── Lockout Overlay ── */}
        {terminalState === 'lockout' && (
          <div className={styles.lockoutOverlay}>
            <div className={styles.lockoutTitle}>SYSTEM LOCKOUT</div>
            <div className={styles.lockoutSubtext}>
              TERMINAL DISABLED — INTRUSION DETECTED
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
