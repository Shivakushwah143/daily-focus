
import React, { useState, useEffect, useCallback } from 'react';
import { RecoilRoot, atom, useRecoilState, useRecoilValue, selector } from 'recoil';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================
// COLOR SYSTEM
// ============================================

const colorThemes = {
  dark: {
    bg: '#111418',
    surface: '#181C22',
    text: '#E8E6E3',
    muted: '#A1A1AA',
    accent: '#4F8CFF',
    accentSoft: 'rgba(79, 140, 255, 0.1)',
    success: '#6BBF9C',
    warning: '#E0B15A',
    border: 'rgba(255, 255, 255, 0.04)'
  },
  light: {
    bg: '#FAFAF9',
    surface: '#FFFFFF',
    text: '#1C1E21',
    muted: '#6B7280',
    accent: '#4F8CFF',
    accentSoft: 'rgba(79, 140, 255, 0.08)',
    success: '#4FA58A',
    warning: '#C99A3A',
    border: 'rgba(0, 0, 0, 0.06)'
  }
};

// Contribution graph colors
const getGraphColor = (score: number, theme: typeof colorThemes.dark) => {
  if (score === 0) return theme.border;
  if (score <= 25) return theme.accentSoft;
  if (score <= 50) return theme.accent;
  if (score <= 75) return theme.success;
  return '#52C881'; // Slightly brighter success for perfect day
};

// ============================================
// TYPES AND INTERFACES
// ============================================

interface Commitment {
  id: string;
  text: string;
  completed: boolean;
  timeSlot?: TimeSlot;
  createdAt: Date;
  locked: boolean;
}

interface TimeSlot {
  start: number; // Hour in 24h format (0-23)
  end: number;   // Hour in 24h format (0-23)
}

interface DayData {
  date: string; // YYYY-MM-DD format
  commitments: Commitment[];
  focusScore: number;
  reflection: string;
  morningQuestion: string;
  completed: boolean;
  focusTime: number; // Minutes
  lastUpdated: Date;
}

interface UserSettings {
  theme: 'dark' | 'light';
  isPro: boolean;
  dailyResetTime: number; // Hour (0-23)
}

// ============================================
// RECOIL ATOM STATES
// ============================================

const currentDayState = atom<DayData>({
  key: 'currentDayState',
  default: {
    date: new Date().toISOString().split('T')[0],
    commitments: [],
    focusScore: 0,
    reflection: '',
    morningQuestion: '',
    completed: false,
    focusTime: 0,
    lastUpdated: new Date()
  }
});

const userSettingsState = atom<UserSettings>({
  key: 'userSettingsState',
  default: {
    theme: 'dark',
    isPro: false,
    dailyResetTime: 6 // 6 AM reset
  }
});

const focusModeState = atom<{
  isActive: boolean;
  currentCommitmentId: string | null;
  timer: number; // Seconds
}>({
  key: 'focusModeState',
  default: {
    isActive: false,
    currentCommitmentId: null,
    timer: 0
  }
});

const uiState = atom<{
  showMorningModal: boolean;
  showReflectionModal: boolean;
  showUpgradeModal: boolean;
  isDragging: boolean;
}>({
  key: 'uiState',
  default: {
    showMorningModal: true,
    showReflectionModal: false,
    showUpgradeModal: false,
    isDragging: false
  }
});

// ============================================
// RECOIL SELECTORS
// ============================================

const commitmentsCountSelector = selector({
  key: 'commitmentsCountSelector',
  get: ({ get }) => {
    const day = get(currentDayState);
    return {
      total: day.commitments.length,
      completed: day.commitments.filter(c => c.completed).length,
      locked: day.commitments.filter(c => c.locked).length
    };
  }
});

const focusScoreSelector = selector({
  key: 'focusScoreSelector',
  get: ({ get }) => {
    const day = get(currentDayState);
    const commitments = get(commitmentsCountSelector);
    
    let score = 0;
    
    // +40 for all commitments completed
    if (commitments.completed === commitments.total && commitments.total > 0) {
      score += 40;
    }
    
    // +20 for focus mode used
    if (day.focusTime > 0) {
      score += 20;
    }
    
    // +20 for reflection written
    if (day.reflection.trim().length > 0) {
      score += 20;
    }
    
    // +20 for no edits after lock
    const hasLockedCommitments = day.commitments.some(c => c.locked);
    const hasEditsAfterLock = false; // This would need tracking
    if (hasLockedCommitments && !hasEditsAfterLock) {
      score += 20;
    }
    
    return Math.min(score, 100);
  }
});

// ============================================
// MAIN APP COMPONENT
// ============================================

function DailyFocusOS() {
  const [dayData, setDayData] = useRecoilState(currentDayState);
  const [settings, setSettings] = useRecoilState(userSettingsState);
  const [focusMode, setFocusMode] = useRecoilState(focusModeState);
  const [ui, setUi] = useRecoilState(uiState);
  
  const commitmentsCount = useRecoilValue(commitmentsCountSelector);
  const focusScore = useRecoilValue(focusScoreSelector);
  
  const currentTheme = colorThemes[settings.theme];
  
  // Initialize with sample commitments for demo
  useEffect(() => {
    const initializeDay = () => {
      if (dayData.commitments.length === 0) {
        setDayData(prev => ({
          ...prev,
          commitments: [
            {
              id: '1',
              text: 'Complete project planning',
              completed: false,
              timeSlot: { start: 9, end: 11 },
              createdAt: new Date(),
              locked: false
            },
            {
              id: '2',
              text: 'Write documentation',
              completed: false,
              timeSlot: { start: 13, end: 15 },
              createdAt: new Date(),
              locked: false
            },
            {
              id: '3',
              text: 'Code review session',
              completed: false,
              timeSlot: { start: 16, end: 17 },
              createdAt: new Date(),
              locked: false
            }
          ]
        }));
      }
    };
    
    initializeDay();
  }, [dayData.commitments.length, setDayData]);
  
  // Focus mode timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (focusMode.isActive && focusMode.timer > 0) {
      interval = setInterval(() => {
        setFocusMode(prev => ({
          ...prev,
          timer: prev.timer - 1
        }));
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [focusMode.isActive, focusMode.timer, setFocusMode]);
  
  const handleAddCommitment = useCallback(() => {
    if (commitmentsCount.total >= 3 && !settings.isPro) {
      // Show upgrade modal or message for 4th slot
      setUi(prev => ({ ...prev, showUpgradeModal: true }));
      return;
    }
    
    if (commitmentsCount.total >= 4) {
      // Max commitments reached
      return;
    }
    
    const newCommitment: Commitment = {
      id: Date.now().toString(),
      text: '',
      completed: false,
      createdAt: new Date(),
      locked: false
    };
    
    setDayData(prev => ({
      ...prev,
      commitments: [...prev.commitments, newCommitment],
      lastUpdated: new Date()
    }));
  }, [commitmentsCount.total, settings.isPro, setDayData, setUi]);
  
  const handleUpdateCommitment = useCallback((id: string, text: string) => {
    setDayData(prev => ({
      ...prev,
      commitments: prev.commitments.map(c => 
        c.id === id ? { ...c, text, lastUpdated: new Date() } : c
      ),
      lastUpdated: new Date()
    }));
  }, [setDayData]);
  
  const handleDeleteCommitment = useCallback((id: string) => {
    setDayData(prev => ({
      ...prev,
      commitments: prev.commitments.filter(c => c.id !== id),
      lastUpdated: new Date()
    }));
  }, [setDayData]);
  
  const handleToggleComplete = useCallback((id: string) => {
    setDayData(prev => ({
      ...prev,
      commitments: prev.commitments.map(c => 
        c.id === id ? { ...c, completed: !c.completed } : c
      ),
      lastUpdated: new Date()
    }));
  }, [setDayData]);
  
  const handleStartFocusMode = useCallback((commitmentId: string) => {
    // Lock all commitments when focus starts
    setDayData(prev => ({
      ...prev,
      commitments: prev.commitments.map(c => ({
        ...c,
        locked: true
      })),
      lastUpdated: new Date()
    }));
    
    setFocusMode({
      isActive: true,
      currentCommitmentId: commitmentId,
      timer: 25 * 60 // 25 minutes
    });
  }, [setDayData, setFocusMode]);
  
  const handleStopFocusMode = useCallback(() => {
    // Add focus time to day data
    const focusTimeMinutes = 25 - Math.floor(focusMode.timer / 60);
    
    setDayData(prev => ({
      ...prev,
      focusTime: prev.focusTime + focusTimeMinutes,
      lastUpdated: new Date()
    }));
    
    setFocusMode({
      isActive: false,
      currentCommitmentId: null,
      timer: 0
    });
  }, [focusMode.timer, setDayData, setFocusMode]);
  
  const handleSubmitMorningQuestion = useCallback((answer: string) => {
    setDayData(prev => ({
      ...prev,
      morningQuestion: answer,
      lastUpdated: new Date()
    }));
    setUi(prev => ({ ...prev, showMorningModal: false }));
  }, [setDayData, setUi]);
  
  const handleSubmitReflection = useCallback((reflection: string) => {
    setDayData(prev => ({
      ...prev,
      reflection,
      completed: true,
      lastUpdated: new Date()
    }));
    setUi(prev => ({ ...prev, showReflectionModal: false }));
  }, [setDayData, setUi]);
  
  const handleDailyReset = useCallback(() => {
    setDayData({
      date: new Date().toISOString().split('T')[0],
      commitments: [],
      focusScore: 0,
      reflection: '',
      morningQuestion: '',
      completed: false,
      focusTime: 0,
      lastUpdated: new Date()
    });
    
    setUi({
      showMorningModal: true,
      showReflectionModal: false,
      showUpgradeModal: false,
      isDragging: false
    });
    
    setFocusMode({
      isActive: false,
      currentCommitmentId: null,
      timer: 0
    });
  }, [setDayData, setFocusMode, setUi]);
  
  const toggleTheme = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark'
    }));
  }, [setSettings]);
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  if (focusMode.isActive) {
    const currentCommitment = dayData.commitments.find(
      c => c.id === focusMode.currentCommitmentId
    );
    
    return (
      <FocusModeView
        commitment={currentCommitment}
        timer={focusMode.timer}
        onStop={handleStopFocusMode}
        theme={currentTheme}
      />
    );
  }
  
  return (
    <div 
      style={{ backgroundColor: currentTheme.bg, color: currentTheme.text }}
      className="min-h-screen transition-colors duration-300"
    >
      {/* Morning Stand-up Modal */}
      <AnimatePresence>
        {ui.showMorningModal && (
          <MorningModal
            onSubmit={handleSubmitMorningQuestion}
            theme={currentTheme}
          />
        )}
      </AnimatePresence>
      
      {/* End-of-Day Reflection Modal */}
      <AnimatePresence>
        {ui.showReflectionModal && (
          <ReflectionModal
            onSubmit={handleSubmitReflection}
            theme={currentTheme}
          />
        )}
      </AnimatePresence>
      
      {/* Upgrade Modal */}
      <AnimatePresence>
        {ui.showUpgradeModal && (
          <UpgradeModal
            onClose={() => setUi(prev => ({ ...prev, showUpgradeModal: false }))}
            theme={currentTheme}
          />
        )}
      </AnimatePresence>
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-12">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold">🧠 DAILY FOCUS OS</h1>
              <p style={{ color: currentTheme.muted }} className="mt-2">
                "You don't manage tasks. You commit to a day."
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <FocusGraph
                theme={currentTheme}
                focusScore={focusScore}
                isPro={settings.isPro}
              />
              
              <button
                onClick={toggleTheme}
                style={{ 
                  color: currentTheme.muted,
                  borderColor: currentTheme.border 
                }}
                className="px-4 py-2 border rounded-lg hover:opacity-80 transition-opacity"
              >
                {settings.theme === 'dark' ? '☀️' : '🌙'}
              </button>
              
              <button
                onClick={() => setUi(prev => ({ ...prev, showReflectionModal: true }))}
                style={{ 
                  color: currentTheme.muted,
                  borderColor: currentTheme.border 
                }}
                className="px-4 py-2 border rounded-lg hover:opacity-80 transition-opacity"
              >
                End Day
              </button>
              
              {!settings.isPro && (
                <button
                  onClick={() => setUi(prev => ({ ...prev, showUpgradeModal: true }))}
                  style={{ 
                    backgroundColor: currentTheme.accent,
                    color: 'white'
                  }}
                  className="px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
                >
                  Upgrade to Pro
                </button>
              )}
            </div>
          </div>
          
          <div style={{ borderColor: currentTheme.border }} className="border-t pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{commitmentsCount.completed}/{commitmentsCount.total}</div>
                <div style={{ color: currentTheme.muted }} className="text-sm">Commitments</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold">{focusScore}/100</div>
                <div style={{ color: currentTheme.muted }} className="text-sm">Focus Score</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold">{dayData.focusTime}m</div>
                <div style={{ color: currentTheme.muted }} className="text-sm">Focus Time</div>
              </div>
            </div>
          </div>
        </header>
        
        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Commitments */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Today's Commitments</h2>
              
              <button
                onClick={handleAddCommitment}
                disabled={commitmentsCount.total >= 4}
                style={{ 
                  color: commitmentsCount.total >= 4 ? currentTheme.muted : currentTheme.accent,
                  opacity: commitmentsCount.total >= 4 ? 0.5 : 1 
                }}
                className={`px-4 py-2 rounded-lg ${commitmentsCount.total >= 4 ? 'cursor-not-allowed' : 'hover:opacity-80'}`}
              >
                + Add Commitment {commitmentsCount.total}/4
              </button>
            </div>
            
            <div className="space-y-4">
              {dayData.commitments.map((commitment, index) => (
                <CommitmentCard
                  key={commitment.id}
                  commitment={commitment}
                  index={index}
                  onUpdate={handleUpdateCommitment}
                  onDelete={handleDeleteCommitment}
                  onToggleComplete={handleToggleComplete}
                  onStartFocus={handleStartFocusMode}
                  theme={currentTheme}
                  isPro={settings.isPro}
                />
              ))}
              
              {/* Locked 4th slot for free users */}
              {commitmentsCount.total >= 3 && !settings.isPro && (
                <div style={{ 
                  borderColor: currentTheme.border,
                  opacity: 0.5
                }} className="border-2 border-dashed rounded-lg p-6">
                  <div className="text-center">
                    <div className="text-xl mb-2">🎯 Deep Work Slot</div>
                    <p style={{ color: currentTheme.muted }} className="mb-4">
                      Upgrade to Pro to unlock your 4th commitment slot
                    </p>
                    <button
                      onClick={() => setUi(prev => ({ ...prev, showUpgradeModal: true }))}
                      style={{ 
                        backgroundColor: currentTheme.accent,
                        color: 'white'
                      }}
                      className="px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
                    >
                      Unlock Pro Feature
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Timeline View */}
            <div className="mt-12">
              <h2 className="text-2xl font-bold mb-6">Daily Timeline</h2>
              <Timeline
                commitments={dayData.commitments}
                theme={currentTheme}
              />
            </div>
          </div>
          
          {/* Right Column - Stats & Actions */}
          <div className="space-y-6">
            {/* Morning Stand-up Question */}
            {dayData.morningQuestion && (
              <div style={{ 
                backgroundColor: currentTheme.surface,
                borderColor: currentTheme.border
              }} className="border rounded-lg p-6">
                <h3 className="font-bold mb-2">Morning Stand-up</h3>
                <p className="italic">"{dayData.morningQuestion}"</p>
              </div>
            )}
            
            {/* Focus Actions */}
            <div style={{ 
              borderColor: currentTheme.border
            }} className="border rounded-lg p-6">
              <h3 className="font-bold mb-4">Focus Actions</h3>
              
              <div className="space-y-3">
                {dayData.commitments.map(commitment => (
                  <button
                    key={commitment.id}
                    onClick={() => handleStartFocusMode(commitment.id)}
                    disabled={commitment.completed}
                    style={{ 
                      color: commitment.completed ? currentTheme.muted : currentTheme.text
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${commitment.completed ? 'cursor-not-allowed' : 'hover:bg-opacity-5'}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="truncate">{commitment.text || 'Untitled'}</span>
                      <span style={{ 
                        color: commitment.completed ? currentTheme.muted : currentTheme.accent
                      }} className="text-sm">
                        → Focus
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              
              <button
                onClick={handleDailyReset}
                style={{ 
                  borderColor: currentTheme.border,
                  color: currentTheme.text
                }}
                className="w-full mt-4 px-4 py-3 rounded-lg border text-center hover:opacity-80 transition-opacity"
              >
                Start New Day
              </button>
            </div>
            
            {/* Pro Features Preview */}
            {!settings.isPro && (
              <div style={{ 
                borderColor: currentTheme.border,
                opacity: 0.7
              }} className="border rounded-lg p-6">
                <h3 className="font-bold mb-4">✨ Pro Features</h3>
                <ul style={{ color: currentTheme.muted }} className="space-y-2 text-sm">
                  <li className="flex items-center">
                    <span className="mr-2">✓</span> 4th commitment slot (Deep Work)
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">✓</span> Full-year focus graph history
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">✓</span> Weekly focus insights & analytics
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">✓</span> Premium themes
                  </li>
                </ul>
                <button
                  onClick={() => setUi(prev => ({ ...prev, showUpgradeModal: true }))}
                  style={{ 
                    backgroundColor: currentTheme.accent,
                    color: 'white'
                  }}
                  className="w-full mt-4 px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
                >
                  Upgrade to Pro
                </button>
              </div>
            )}
            
            {/* End of Day Reflection */}
            {dayData.reflection && (
              <div style={{ 
                backgroundColor: currentTheme.surface,
                borderColor: currentTheme.border
              }} className="border rounded-lg p-6">
                <h3 className="font-bold mb-2">End of Day Reflection</h3>
                <p className="italic">"{dayData.reflection}"</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// ============================================
// COMPONENTS
// ============================================

function FocusModeView({ commitment, timer, onStop, theme }: {
  commitment: Commitment | undefined;
  timer: number;
  onStop: () => void;
  theme: typeof colorThemes.dark;
}) {
  return (
    <div 
      style={{ backgroundColor: theme.bg }}
      className="min-h-screen flex flex-col items-center justify-center p-8"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl w-full text-center"
      >
        <div style={{ color: theme.accent }} className="text-8xl font-bold mb-8">
          {formatTime(timer)}
        </div>
        
        <div className="text-2xl mb-12">
          {commitment?.text || 'Focus Session'}
        </div>
        
        <div className="space-y-4">
          <button
            onClick={onStop}
            style={{ 
              backgroundColor: theme.success,
              color: 'white'
            }}
            className="px-8 py-4 rounded-lg text-lg hover:opacity-80 transition-opacity"
          >
            Complete Session
          </button>
          
          <p style={{ color: theme.muted }} className="text-sm">
            Everything else is hidden. Just this commitment.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function CommitmentCard({ commitment, index, onUpdate, onDelete, onToggleComplete, onStartFocus, theme, isPro }: {
  commitment: Commitment;
  index: number;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onStartFocus: (id: string) => void;
  theme: typeof colorThemes.dark;
  isPro: boolean;
}) {
  const [isEditing, setIsEditing] = useState(!commitment.text);
  const [text, setText] = useState(commitment.text);
  
  const handleSave = () => {
    if (text.trim()) {
      onUpdate(commitment.id, text);
      setIsEditing(false);
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ 
        borderColor: theme.border,
        opacity: commitment.completed ? 0.6 : 1
      }}
      className="border rounded-lg p-6"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <span style={{ color: theme.muted }} className="mr-3 text-lg">#{index + 1}</span>
            
            {isEditing ? (
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onBlur={handleSave}
                  onKeyPress={handleKeyPress}
                  style={{ 
                    color: commitment.completed ? theme.muted : theme.text,
                    backgroundColor: 'transparent'
                  }}
                  className="w-full border-b focus:outline-none"
                  placeholder="What will you commit to today?"
                  autoFocus
                />
                <div 
                  style={{ backgroundColor: theme.accent }}
                  className="absolute bottom-0 left-0 right-0 h-0.5 transform scale-x-0 transition-transform duration-200 focus-within:scale-x-100"
                />
              </div>
            ) : (
              <div
                onClick={() => !commitment.locked && setIsEditing(true)}
                style={{ 
                  color: commitment.completed ? theme.muted : theme.text,
                  cursor: commitment.locked ? 'default' : 'pointer'
                }}
                className="flex-1 hover:opacity-80 transition-opacity"
              >
                {commitment.text || 'Click to edit commitment...'}
              </div>
            )}
          </div>
          
          {commitment.timeSlot && (
            <div style={{ color: theme.muted }} className="text-sm ml-8">
              🕐 {commitment.timeSlot.start}:00 - {commitment.timeSlot.end}:00
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2 ml-4">
          {/* Completed indicator */}
          <button
            onClick={() => onToggleComplete(commitment.id)}
            className="relative"
          >
            <div 
              style={{ borderColor: theme.border }}
              className="w-8 h-8 rounded-full border flex items-center justify-center"
            >
              {commitment.completed && (
                <div 
                  style={{ backgroundColor: theme.success }}
                  className="w-3 h-3 rounded-full"
                />
              )}
            </div>
          </button>
          
          {/* Start Focus Button */}
          <button
            onClick={() => onStartFocus(commitment.id)}
            disabled={commitment.completed || commitment.locked}
            style={{ 
              backgroundColor: commitment.completed || commitment.locked ? theme.border : theme.accent,
              color: 'white',
              opacity: commitment.completed || commitment.locked ? 0.5 : 1
            }}
            className="px-3 py-1 rounded text-sm font-medium hover:opacity-80 transition-opacity"
          >
            Focus
          </button>
          
          {/* Delete button (only if not locked) */}
          {!commitment.locked && (
            <button
              onClick={() => onDelete(commitment.id)}
              style={{ 
                color: theme.muted,
                borderColor: theme.border
              }}
              className="w-8 h-8 flex items-center justify-center rounded-full border hover:opacity-80 transition-opacity"
            >
              ×
            </button>
          )}
        </div>
      </div>
      
      {/* Lock indicator */}
      {commitment.locked && (
        <div style={{ color: theme.muted }} className="mt-3 text-sm flex items-center">
          <span className="mr-2">🔒</span>
          Locked (editing breaks focus streak)
        </div>
      )}
    </motion.div>
  );
}

function Timeline({ commitments, theme }: {
  commitments: Commitment[];
  theme: typeof colorThemes.dark;
}) {
  const hours = Array.from({ length: 12 }, (_, i) => i + 9); // 9 AM to 9 PM
  
  return (
    <div style={{ borderColor: theme.border }} className="border rounded-lg p-6">
      <div className="relative h-96">
        {/* Hour markers */}
        {hours.map(hour => (
          <div
            key={hour}
            className="absolute left-0 right-0"
            style={{ top: `${((hour - 9) / 12) * 100}%` }}
          >
            <div style={{ color: theme.muted }} className="text-sm">
              {hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
            </div>
            <div style={{ borderColor: theme.border }} className="border-t absolute left-12 right-0 top-1/2" />
          </div>
        ))}
        
        {/* Commitment blocks */}
        {commitments.map(commitment => {
          if (!commitment.timeSlot) return null;
          
          const top = ((commitment.timeSlot.start - 9) / 12) * 100;
          const height = ((commitment.timeSlot.end - commitment.timeSlot.start) / 12) * 100;
          
          return (
            <div
              key={commitment.id}
              style={{ 
                top: `${top}%`,
                height: `${height}%`,
                backgroundColor: commitment.completed ? 
                  `rgba(107, 191, 156, ${theme === colorThemes.dark ? 0.15 : 0.1})` : 
                  `rgba(79, 140, 255, ${theme === colorThemes.dark ? 0.1 : 0.08})`,
                borderColor: commitment.completed ? 
                  'rgba(107, 191, 156, 0.3)' : 
                  'rgba(79, 140, 255, 0.3)',
                color: commitment.completed ? theme.success : theme.accent
              }}
              className="absolute left-12 right-4 rounded-lg p-3 border"
            >
              <div className="font-medium">{commitment.text}</div>
              <div className="text-sm opacity-75">
                {commitment.timeSlot.start}:00 - {commitment.timeSlot.end}:00
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FocusGraph({ theme, focusScore, isPro }: {
  theme: typeof colorThemes.dark;
  focusScore: number;
  isPro: boolean;
}) {
  // Generate mock data for 30 days
  const days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return {
      date: date.toISOString().split('T')[0],
      score: i === 29 ? focusScore : Math.floor(Math.random() * 101)
    };
  });
  
  return (
    <div style={{ borderColor: theme.border }} className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">Focus Graph</div>
        {!isPro && <span style={{ color: theme.muted }} className="text-xs">30d</span>}
      </div>
      
      <div className="flex items-end space-x-1">
        {days.map((day, index) => (
          <div
            key={day.date}
            title={`${day.date}: ${day.score} points`}
            className={`w-3 rounded-sm ${index === 29 ? 'ring-2 ring-opacity-30' : ''}`}
            style={{
              height: `${(day.score / 100) * 32}px`,
              backgroundColor: getGraphColor(day.score, theme),
              opacity: day.score === 0 ? 0.3 : 1,
              borderColor: index === 29 ? theme.accent : 'transparent'
            }}
          />
        ))}
      </div>
      
      {!isPro && (
        <div style={{ color: theme.muted }} className="text-xs mt-2 text-center">
          Pro: 1 year history
        </div>
      )}
    </div>
  );
}

function MorningModal({ onSubmit, theme }: {
  onSubmit: (answer: string) => void;
  theme: typeof colorThemes.dark;
}) {
  const [answer, setAnswer] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answer.trim()) {
      onSubmit(answer.trim());
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{ 
          backgroundColor: theme.bg,
          borderColor: theme.border
        }}
        className="rounded-2xl p-8 max-w-md w-full border"
      >
        <div className="text-center mb-6">
          <div className="text-4xl mb-4">🌅</div>
          <h2 className="text-2xl font-bold mb-2">Morning Stand-up</h2>
          <p style={{ color: theme.muted }}>
            Start your day with intention
          </p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <label className="block mb-4">
            <div className="font-medium mb-2">
              What makes today successful?
            </div>
            <div className="relative">
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                style={{ 
                  backgroundColor: 'transparent',
                  borderColor: theme.border,
                  color: theme.text
                }}
                className="w-full border rounded-lg p-4 focus:outline-none resize-none"
                rows={3}
                placeholder="Today will be successful if I..."
                autoFocus
              />
              <div 
                style={{ backgroundColor: theme.accent }}
                className="absolute bottom-0 left-4 right-4 h-0.5 transform scale-x-0 transition-transform duration-200 focus-within:scale-x-100"
              />
            </div>
          </label>
          
          <button
            type="submit"
            disabled={!answer.trim()}
            style={{ 
              backgroundColor: answer.trim() ? theme.accent : theme.border,
              color: 'white',
              opacity: answer.trim() ? 1 : 0.5
            }}
            className="w-full py-3 rounded-lg font-medium hover:opacity-80 transition-opacity"
          >
            Start My Day
          </button>
        </form>
        
        <p style={{ color: theme.muted }} className="text-sm text-center mt-4">
          This sets the tone for your day. Be specific.
        </p>
      </motion.div>
    </div>
  );
}

function ReflectionModal({ onSubmit, theme }: {
  onSubmit: (reflection: string) => void;
  theme: typeof colorThemes.dark;
}) {
  const [reflection, setReflection] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reflection.trim()) {
      onSubmit(reflection.trim());
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{ 
          backgroundColor: theme.surface,
          borderColor: theme.border
        }}
        className="rounded-2xl p-8 max-w-md w-full border"
      >
        <div className="text-center mb-6">
          <div className="text-4xl mb-4">🌙</div>
          <h2 className="text-2xl font-bold mb-2">End of Day Reflection</h2>
          <p style={{ color: theme.muted }}>
            Close your day with awareness
          </p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <label className="block mb-4">
            <div className="font-medium mb-2">
              How did today go?
            </div>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              style={{ 
                backgroundColor: theme.accentSoft,
                borderColor: 'transparent',
                color: theme.text
              }}
              className="w-full rounded-lg p-4 focus:outline-none focus:ring-2 resize-none"
              rows={3}
              placeholder="Today was meaningful because..."
              autoFocus
            />
          </label>
          
          <button
            type="submit"
            disabled={!reflection.trim()}
            style={{ 
              backgroundColor: reflection.trim() ? theme.accent : theme.border,
              color: 'white',
              opacity: reflection.trim() ? 1 : 0.5
            }}
            className="w-full py-3 rounded-lg font-medium hover:opacity-80 transition-opacity"
          >
            Complete Day
          </button>
        </form>
        
        <p style={{ color: theme.muted }} className="text-sm text-center mt-4">
          Required to close your day and update your focus graph
        </p>
      </motion.div>
    </div>
  );
}

function UpgradeModal({ onClose, theme }: {
  onClose: () => void;
  theme: typeof colorThemes.dark;
}) {
  const proFeatures = [
    '4th commitment slot (Deep Work)',
    'Full-year focus graph history',
    'Weekly focus insights & analytics',
    'Premium themes',
    'Streak protection & recovery',
    'Advanced time blocking'
  ];
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{ 
          backgroundColor: theme.surface,
          borderColor: theme.border
        }}
        className="rounded-2xl p-8 max-w-lg w-full border"
      >
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">🚀</div>
          <h2 className="text-3xl font-bold mb-2">Upgrade to Pro</h2>
          <p style={{ color: theme.muted }}>
            Unlock your full focus potential
          </p>
        </div>
        
        <div className="mb-8">
          <div className="text-center mb-6">
            <span className="text-5xl font-bold">$7</span>
            <span style={{ color: theme.muted }}>/month</span>
          </div>
          
          <div className="space-y-3 mb-6">
            {proFeatures.map((feature, index) => (
              <div key={index} className="flex items-center">
                <span style={{ color: theme.success }} className="mr-3">✓</span>
                <span>{feature}</span>
              </div>
            ))}
          </div>
          
          <div style={{ 
            backgroundColor: theme.accentSoft,
            color: theme.accent
          }} className="rounded-lg p-4 mb-6">
            <div className="font-medium mb-1">Early Lifetime Offer</div>
            <div style={{ color: theme.muted }} className="text-sm">
              First 1000 users: $49 one-time payment
            </div>
          </div>
        </div>
        
        <div className="space-y-3">
          <button
            onClick={onClose}
            style={{ 
              backgroundColor: theme.accent,
              color: 'white'
            }}
            className="w-full py-3 rounded-lg font-medium hover:opacity-80 transition-opacity"
          >
            Upgrade to Pro - $7/month
          </button>
          
          <button
            onClick={onClose}
            style={{ 
              borderColor: theme.border,
              color: theme.text
            }}
            className="w-full py-3 rounded-lg border font-medium hover:opacity-80 transition-opacity"
          >
            Maybe Later
          </button>
        </div>
        
        <p style={{ color: theme.muted }} className="text-sm text-center mt-6">
          Free forever remains fully functional with 3 commitments
        </p>
      </motion.div>
    </div>
  );
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================
// ROOT COMPONENT WITH RECOIL PROVIDER
// ============================================

function App() {
  return (
    <RecoilRoot>
      <DailyFocusOS />
    </RecoilRoot>
  );
}

export default App;