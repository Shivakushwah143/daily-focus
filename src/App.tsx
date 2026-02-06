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

// Rotating placeholder examples (non-tech)
const placeholders = [
  "Finish my pending work",
  "Study for 1 hour", 
  "Go for a walk",
  "Call a family member",
  "Read 20 pages",
  "Cook a healthy meal"
];

// ============================================
// TYPES AND INTERFACES
// ============================================

interface Task {
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
  tasks: Task[];
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
  isFirstTime: boolean; // Track first-time user
}

// ============================================
// RECOIL ATOM STATES
// ============================================

const currentDayState = atom<DayData>({
  key: 'currentDayState',
  default: {
    date: new Date().toISOString().split('T')[0],
    tasks: [],
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
    dailyResetTime: 6, // 6 AM reset
    isFirstTime: true // Start as first-time user
  }
});

const focusModeState = atom<{
  isActive: boolean;
  currentTaskId: string | null;
  timer: number; // Seconds
}>({
  key: 'focusModeState',
  default: {
    isActive: false,
    currentTaskId: null,
    timer: 0
  }
});

const uiState = atom<{
  showMorningModal: boolean;
  showReflectionModal: boolean;
  showUpgradeModal: boolean;
  showFeedbackModal: boolean;
  isDragging: boolean;
  currentPlaceholder: number;
  mobileActiveTab: 'today' | 'focus' | 'progress' | 'more';
}>({
  key: 'uiState',
  default: {
    showMorningModal: true,
    showReflectionModal: false,
    showUpgradeModal: false,
    showFeedbackModal: false,
    isDragging: false,
    currentPlaceholder: 0,
    mobileActiveTab: 'today'
  }
});

// ============================================
// RECOIL SELECTORS
// ============================================

const tasksCountSelector = selector({
  key: 'tasksCountSelector',
  get: ({ get }) => {
    const day = get(currentDayState);
    return {
      total: day.tasks.length,
      completed: day.tasks.filter(c => c.completed).length,
      locked: day.tasks.filter(c => c.locked).length
    };
  }
});

const focusScoreSelector = selector({
  key: 'focusScoreSelector',
  get: ({ get }) => {
    const day = get(currentDayState);
    const tasks = get(tasksCountSelector);
    
    let score = 0;
    
    // +40 for all tasks completed
    if (tasks.completed === tasks.total && tasks.total > 0) {
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
    const hasLockedTasks = day.tasks.some(c => c.locked);
    const hasEditsAfterLock = false; // This would need tracking
    if (hasLockedTasks && !hasEditsAfterLock) {
      score += 20;
    }
    
    return Math.min(score, 100);
  }
});

// ============================================
// MOBILE BOTTOM NAV COMPONENT
// ============================================

function BottomNavigation({ activeTab, onTabChange, theme }: {
  activeTab: string;
  onTabChange: (tab: 'today' | 'focus' | 'progress' | 'more') => void;
  theme: typeof colorThemes.dark;
}) {
  const tabs = [
    { id: 'today', label: 'Today', icon: '📝' },
    { id: 'focus', label: 'Focus', icon: '🎯' },
    { id: 'progress', label: 'Progress', icon: '📊' },
    { id: 'more', label: 'More', icon: '⚙️' }
  ] as const;

  return (
    <div 
      style={{ 
        backgroundColor: theme.surface,
        borderTopColor: theme.border
      }}
      className="fixed bottom-0 left-0 right-0 h-16 border-t md:hidden z-40"
    >
      <div className="flex h-full items-center justify-around">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="flex flex-col items-center justify-center w-full h-full"
          >
            <div 
              className="text-lg mb-1"
              style={{ 
                color: activeTab === tab.id ? theme.accent : theme.muted,
                opacity: activeTab === tab.id ? 1 : 0.7
              }}
            >
              {tab.icon}
            </div>
            <div 
              className="text-xs"
              style={{ 
                color: activeTab === tab.id ? theme.accent : theme.muted,
                opacity: activeTab === tab.id ? 1 : 0.7
              }}
            >
              {tab.label}
            </div>
            {activeTab === tab.id && (
              <div 
                style={{ backgroundColor: theme.accent }}
                className="w-1 h-1 rounded-full mt-1"
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================
// MOBILE SCREEN COMPONENTS
// ============================================

function MobileTodayScreen({ 
  dayData, 
  settings, 
  tasksCount, 
  focusScore,
  currentTheme,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onToggleComplete,
  onStartFocus,
  onShowReflection,
  onShowUpgrade,
  isPro
}: {
  dayData: DayData;
  settings: UserSettings;
  tasksCount: ReturnType<typeof tasksCountSelector>;
  focusScore: number;
  currentTheme: typeof colorThemes.dark;
  onAddTask: () => void;
  onUpdateTask: (id: string, text: string) => void;
  onDeleteTask: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onStartFocus: (id: string) => void;
  onShowReflection: () => void;
  onShowUpgrade: () => void;
  isPro: boolean;
}) {
  return (
    <div className="pb-20">
      {/* Header Stats */}
      <div className="mb-6">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-xl font-bold">{tasksCount.completed}/{tasksCount.total}</div>
            <div style={{ color: currentTheme.muted }} className="text-xs">Tasks</div>
          </div>
          
          <div className="text-center">
            <div className="text-xl font-bold">{focusScore}/100</div>
            <div style={{ color: currentTheme.muted }} className="text-xs">Score</div>
          </div>
          
          <div className="text-center">
            <div className="text-xl font-bold">{dayData.focusTime}m</div>
            <div style={{ color: currentTheme.muted }} className="text-xs">Focus</div>
          </div>
        </div>
        
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Today's Tasks</h2>
          <button
            onClick={onAddTask}
            disabled={tasksCount.total >= 4}
            style={{ 
              color: tasksCount.total >= 4 ? currentTheme.muted : currentTheme.accent,
              opacity: tasksCount.total >= 4 ? 0.5 : 1 
            }}
            className={`px-3 py-1 text-sm ${tasksCount.total >= 4 ? 'cursor-not-allowed' : 'hover:opacity-80'}`}
          >
            + Add {tasksCount.total}/4
          </button>
        </div>
      </div>

      {/* First-time user empty state */}
      {settings.isFirstTime && dayData.tasks.length === 0 ? (
        <div style={{ 
          backgroundColor: currentTheme.accentSoft,
          borderColor: currentTheme.border
        }} className="border rounded-lg p-6 text-center mb-6">
          <div className="text-3xl mb-3">🎯</div>
          <h3 className="text-lg font-medium mb-2">Start with one task</h3>
          <p style={{ color: currentTheme.muted }} className="mb-4 text-sm">
            What's the one thing you want to finish today?
          </p>
          <button
            onClick={onAddTask}
            style={{ 
              backgroundColor: currentTheme.accent,
              color: 'white'
            }}
            className="px-6 py-2 rounded-lg font-medium hover:opacity-80"
          >
            Add My First Task
          </button>
        </div>
      ) : (
        <>
          {/* Tasks List */}
          <div className="space-y-3 mb-6">
            {dayData.tasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                onUpdate={onUpdateTask}
                onDelete={onDeleteTask}
                onToggleComplete={onToggleComplete}
                onStartFocus={onStartFocus}
                theme={currentTheme}
                isPro={isPro}
                isMobile={true}
              />
            ))}
            
            {/* Add task hint for first-time users with 1 task */}
            {settings.isFirstTime && dayData.tasks.length === 1 && (
              <div style={{ 
                backgroundColor: currentTheme.accentSoft,
                borderColor: currentTheme.accent
              }} className="border rounded-lg p-4">
                <p style={{ color: currentTheme.accent }} className="text-sm text-center">
                  ✨ You can add up to 3 tasks per day.
                </p>
              </div>
            )}
            
            {/* Locked 4th slot */}
            {tasksCount.total >= 3 && !isPro && (
              <div style={{ 
                borderColor: currentTheme.border,
                opacity: 0.5
              }} className="border-2 border-dashed rounded-lg p-4">
                <div className="text-center">
                  <div className="text-lg mb-2">🎯 Deep Work Slot</div>
                  <p style={{ color: currentTheme.muted }} className="text-sm mb-3">
                    Upgrade to Pro for 4th task
                  </p>
                  <button
                    onClick={onShowUpgrade}
                    style={{ 
                      backgroundColor: currentTheme.accent,
                      color: 'white'
                    }}
                    className="px-3 py-1 rounded-lg font-medium text-sm hover:opacity-90"
                  >
                    Unlock Pro
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Today's Focus Question */}
          {dayData.morningQuestion && (
            <div style={{ 
              backgroundColor: currentTheme.surface,
              borderColor: currentTheme.border
            }} className="border rounded-lg p-4 mb-6">
              <h3 className="font-bold mb-2 text-sm">Today's Focus</h3>
              <p className="italic text-sm">"{dayData.morningQuestion}"</p>
            </div>
          )}

          {/* Focus Actions */}
          <div style={{ 
            borderColor: currentTheme.border
          }} className="border rounded-lg p-4 mb-6">
            <h3 className="font-bold mb-3 text-sm">Focus Now</h3>
            
            <div className="space-y-2">
              {dayData.tasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => onStartFocus(task.id)}
                  disabled={task.completed}
                  style={{ 
                    backgroundColor: task.completed ? 'transparent' : currentTheme.accent,
                    color: task.completed ? currentTheme.muted : 'white',
                    opacity: task.completed ? 0.5 : 1
                  }}
                  className={`w-full px-3 py-3 rounded-lg text-sm font-medium ${task.completed ? 'cursor-not-allowed' : 'hover:opacity-80'}`}
                  title="Work on this without distractions"
                >
                  <div className="flex justify-between items-center">
                    <span className="truncate">{task.text || 'Untitled'}</span>
                    <span>Start</span>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t" style={{ borderColor: currentTheme.border }}>
              <button
                onClick={onShowReflection}
                style={{ 
                  borderColor: currentTheme.border,
                  color: currentTheme.text
                }}
                className="w-full px-3 py-2 rounded-lg border text-center text-sm hover:opacity-80"
              >
                End Day
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MobileFocusScreen({
  dayData,
  currentTheme,
  onStartFocus
}: {
  dayData: DayData;
  currentTheme: typeof colorThemes.dark;
  onStartFocus: (id: string) => void;
}) {
  return (
    <div className="pb-20">
      <div className="text-center mb-8">
        <div className="text-4xl mb-4">🎯</div>
        <h2 className="text-xl font-bold mb-2">Focus Mode</h2>
        <p style={{ color: currentTheme.muted }} className="text-sm">
          Work on one thing without distractions
        </p>
      </div>

      {dayData.tasks.length === 0 ? (
        <div style={{ 
          backgroundColor: currentTheme.accentSoft,
          borderColor: currentTheme.border
        }} className="border rounded-lg p-6 text-center">
          <div className="text-3xl mb-3">📝</div>
          <h3 className="text-lg font-medium mb-2">No tasks yet</h3>
          <p style={{ color: currentTheme.muted }} className="text-sm">
            Add a task first to start focusing
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {dayData.tasks.map(task => (
            <div
              key={task.id}
              style={{ 
                borderColor: currentTheme.border,
                backgroundColor: task.completed ? currentTheme.accentSoft : currentTheme.surface
              }}
              className="border rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="font-medium mb-1">{task.text || 'Untitled'}</div>
                  {task.completed && (
                    <div style={{ color: currentTheme.success }} className="text-xs">
                      ✓ Completed
                    </div>
                  )}
                </div>
              </div>
              
              <button
                onClick={() => onStartFocus(task.id)}
                disabled={task.completed}
                style={{ 
                  backgroundColor: task.completed ? currentTheme.border : currentTheme.accent,
                  color: 'white',
                  opacity: task.completed ? 0.5 : 1
                }}
                className="w-full py-3 rounded-lg font-medium hover:opacity-80 transition-opacity"
              >
                {task.completed ? 'Task Completed' : 'Start 25-Minute Focus'}
              </button>
            </div>
          ))}
          
          <div style={{ color: currentTheme.muted }} className="text-sm text-center mt-6">
            <p>Focus mode hides everything except your task and a timer.</p>
            <p className="mt-1">No notifications. No distractions.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function MobileProgressScreen({
  focusScore,
  isPro,
  currentTheme,
  onShowUpgrade
}: {
  focusScore: number;
  isPro: boolean;
  currentTheme: typeof colorThemes.dark;
  onShowUpgrade: () => void;
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

  const streaks = {
    current: Math.floor(Math.random() * 7) + 1,
    longest: Math.floor(Math.random() * 30) + 7
  };

  return (
    <div className="pb-20">
      <div className="text-center mb-6">
        <div className="text-4xl mb-4">📊</div>
        <h2 className="text-xl font-bold mb-2">Your Progress</h2>
        <p style={{ color: currentTheme.muted }} className="text-sm">
          Track your daily focus and streaks
        </p>
      </div>

      {/* Daily Score */}
      <div style={{ 
        backgroundColor: currentTheme.surface,
        borderColor: currentTheme.border
      }} className="border rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">Today's Score</div>
          <div style={{ color: currentTheme.accent }} className="text-lg font-bold">{focusScore}/100</div>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div 
            style={{ 
              backgroundColor: getGraphColor(focusScore, currentTheme),
              width: `${focusScore}%`
            }}
            className="h-2 rounded-full transition-all duration-500"
          />
        </div>
        <div style={{ color: currentTheme.muted }} className="text-xs mt-2">
          Based on task completion and focus time
        </div>
      </div>

      {/* Focus Graph */}
      <div style={{ 
        borderColor: currentTheme.border
      }} className="border rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="font-medium">Focus Graph</div>
          {!isPro && <span style={{ color: currentTheme.muted }} className="text-xs">30 days</span>}
        </div>
        
        <div className="flex items-end gap-1 mb-3">
          {days.map((day, index) => (
            <div
              key={day.date}
              className={`w-2 rounded-sm ${index === 29 ? 'ring-1 ring-opacity-30' : ''}`}
              style={{
                height: `${(day.score / 100) * 24}px`,
                backgroundColor: getGraphColor(day.score, currentTheme),
                opacity: day.score === 0 ? 0.3 : 1,
                borderColor: index === 29 ? currentTheme.accent : 'transparent'
              }}
            />
          ))}
        </div>
        
        {!isPro && (
          <div className="text-center">
            <button
              onClick={onShowUpgrade}
              style={{ 
                backgroundColor: currentTheme.accent,
                color: 'white'
              }}
              className="w-full py-2 rounded-lg font-medium text-sm hover:opacity-90"
            >
              Unlock 1 Year History
            </button>
          </div>
        )}
      </div>

      {/* Streaks */}
      <div style={{ 
        backgroundColor: currentTheme.surface,
        borderColor: currentTheme.border
      }} className="border rounded-lg p-4 mb-6">
        <h3 className="font-medium mb-3">Streaks</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{streaks.current} days</div>
            <div style={{ color: currentTheme.muted }} className="text-xs">Current streak</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{streaks.longest} days</div>
            <div style={{ color: currentTheme.muted }} className="text-xs">Longest streak</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileMoreScreen({
  currentTheme,
  onShowUpgrade,
  onShowFeedback,
  onDailyReset,
  isPro,
  theme,
  onToggleTheme
}: {
  currentTheme: typeof colorThemes.dark;
  onShowUpgrade: () => void;
  onShowFeedback: () => void;
  onDailyReset: () => void;
  isPro: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}) {
  return (
    <div className="pb-20">
      <div className="text-center mb-6">
        <div className="text-4xl mb-4">⚙️</div>
        <h2 className="text-xl font-bold mb-2">More</h2>
        <p style={{ color: currentTheme.muted }} className="text-sm">
          Settings and actions
        </p>
      </div>

      <div className="space-y-3">
        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          style={{ 
            backgroundColor: currentTheme.surface,
            borderColor: currentTheme.border
          }}
          className="w-full border rounded-lg p-4 text-left hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Theme</div>
              <div style={{ color: currentTheme.muted }} className="text-sm">
                {theme === 'dark' ? 'Dark mode' : 'Light mode'}
              </div>
            </div>
            <div className="text-xl">
              {theme === 'dark' ? '🌙' : '☀️'}
            </div>
          </div>
        </button>

        {/* Start New Day */}
        <button
          onClick={onDailyReset}
          style={{ 
            backgroundColor: currentTheme.surface,
            borderColor: currentTheme.border
          }}
          className="w-full border rounded-lg p-4 text-left hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Start New Day</div>
              <div style={{ color: currentTheme.muted }} className="text-sm">
                Reset all tasks for a fresh start
              </div>
            </div>
            <div className="text-xl">🔄</div>
          </div>
        </button>

        {/* Feature Request */}
        <button
          onClick={onShowFeedback}
          style={{ 
            backgroundColor: currentTheme.surface,
            borderColor: currentTheme.border
          }}
          className="w-full border rounded-lg p-4 text-left hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Feature Request</div>
              <div style={{ color: currentTheme.muted }} className="text-sm">
                Suggest improvements
              </div>
            </div>
            <div className="text-xl">💡</div>
          </div>
        </button>

        {/* Upgrade */}
        {!isPro && (
          <button
            onClick={onShowUpgrade}
            style={{ 
              backgroundColor: currentTheme.accent,
              color: 'white'
            }}
            className="w-full rounded-lg p-4 text-center font-medium hover:opacity-90 transition-opacity"
          >
            <div className="flex items-center justify-center">
              <div className="mr-2">🚀</div>
              <div>Unlock Pro Features</div>
            </div>
          </button>
        )}

        {/* Pro Features Preview */}
        {!isPro && (
          <div style={{ 
            borderColor: currentTheme.border,
            opacity: 0.7
          }} className="border rounded-lg p-4">
            <h3 className="font-medium mb-2">✨ Pro Features</h3>
            <ul style={{ color: currentTheme.muted }} className="space-y-1 text-xs">
              <li className="flex items-center">
                <span className="mr-2">✓</span> 4th task slot
              </li>
              <li className="flex items-center">
                <span className="mr-2">✓</span> Full-year history
              </li>
              <li className="flex items-center">
                <span className="mr-2">✓</span> Advanced analytics
              </li>
              <li className="flex items-center">
                <span className="mr-2">✓</span> Premium themes
              </li>
            </ul>
          </div>
        )}

        {/* About */}
        <div style={{ 
          backgroundColor: currentTheme.surface,
          borderColor: currentTheme.border
        }} className="border rounded-lg p-4">
          <h3 className="font-medium mb-2">About Daily Focus OS</h3>
          <p style={{ color: currentTheme.muted }} className="text-sm">
            A simple tool to help you commit to what matters each day. 
            No endless task lists. Just 1-3 things to focus on.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN APP COMPONENT
// ============================================

function DailyFocusOS() {
  const [dayData, setDayData] = useRecoilState(currentDayState);
  const [settings, setSettings] = useRecoilState(userSettingsState);
  const [focusMode, setFocusMode] = useRecoilState(focusModeState);
  const [ui, setUi] = useRecoilState(uiState);
  
  const tasksCount = useRecoilValue(tasksCountSelector);
  const focusScore = useRecoilValue(focusScoreSelector);
  
  const currentTheme = colorThemes[settings.theme];

  // Rotate placeholders
  useEffect(() => {
    const interval = setInterval(() => {
      setUi(prev => ({
        ...prev,
        currentPlaceholder: (prev.currentPlaceholder + 1) % placeholders.length
      }));
    }, 3000);
    
    return () => clearInterval(interval);
  }, [setUi]);
  
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
  
  const handleAddTask = useCallback(() => {
    if (tasksCount.total >= 3 && !settings.isPro) {
      setUi(prev => ({ ...prev, showUpgradeModal: true }));
      return;
    }
    
    if (tasksCount.total >= 4) {
      return;
    }
    
    // Mark user as not first-time after they add first task
    if (settings.isFirstTime) {
      setSettings(prev => ({ ...prev, isFirstTime: false }));
    }
    
    const newTask: Task = {
      id: Date.now().toString(),
      text: '',
      completed: false,
      createdAt: new Date(),
      locked: false
    };
    
    setDayData(prev => ({
      ...prev,
      tasks: [...prev.tasks, newTask],
      lastUpdated: new Date()
    }));
  }, [tasksCount.total, settings.isPro, settings.isFirstTime, setDayData, setSettings, setUi]);
  
  const handleUpdateTask = useCallback((id: string, text: string) => {
    setDayData(prev => ({
      ...prev,
      tasks: prev.tasks.map(c => 
        c.id === id ? { ...c, text, lastUpdated: new Date() } : c
      ),
      lastUpdated: new Date()
    }));
  }, [setDayData]);
  
  const handleDeleteTask = useCallback((id: string) => {
    setDayData(prev => ({
      ...prev,
      tasks: prev.tasks.filter(c => c.id !== id),
      lastUpdated: new Date()
    }));
  }, [setDayData]);
  
  const handleToggleComplete = useCallback((id: string) => {
    setDayData(prev => ({
      ...prev,
      tasks: prev.tasks.map(c => 
        c.id === id ? { ...c, completed: !c.completed } : c
      ),
      lastUpdated: new Date()
    }));
  }, [setDayData]);
  
  const handleStartFocusMode = useCallback((taskId: string) => {
    setDayData(prev => ({
      ...prev,
      tasks: prev.tasks.map(c => ({
        ...c,
        locked: true
      })),
      lastUpdated: new Date()
    }));
    
    setFocusMode({
      isActive: true,
      currentTaskId: taskId,
      timer: 25 * 60 // 25 minutes
    });
  }, [setDayData, setFocusMode]);
  
  const handleStopFocusMode = useCallback(() => {
    const focusTimeMinutes = 25 - Math.floor(focusMode.timer / 60);
    
    setDayData(prev => ({
      ...prev,
      focusTime: prev.focusTime + focusTimeMinutes,
      lastUpdated: new Date()
    }));
    
    setFocusMode({
      isActive: false,
      currentTaskId: null,
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
      tasks: [],
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
      showFeedbackModal: false,
      isDragging: false,
      currentPlaceholder: 0,
      mobileActiveTab: 'today'
    });
    
    setFocusMode({
      isActive: false,
      currentTaskId: null,
      timer: 0
    });
  }, [setDayData, setFocusMode, setUi]);
  
  const toggleTheme = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark'
    }));
  }, [setSettings]);

  const handleTabChange = useCallback((tab: 'today' | 'focus' | 'progress' | 'more') => {
    setUi(prev => ({ ...prev, mobileActiveTab: tab }));
  }, [setUi]);
  
  if (focusMode.isActive) {
    const currentTask = dayData.tasks.find(
      c => c.id === focusMode.currentTaskId
    );
    
    return (
      <FocusModeView
        task={currentTask}
        timer={focusMode.timer}
        onStop={handleStopFocusMode}
        theme={currentTheme}
      />
    );
  }
  
  return (
    <div 
      style={{ backgroundColor: currentTheme.bg, color: currentTheme.text }}
      className="min-h-screen w-full transition-colors duration-300"
    >
      {/* Plan Today Modal */}
      <AnimatePresence>
        {ui.showMorningModal && (
          <PlanTodayModal
            onSubmit={handleSubmitMorningQuestion}
            onClose={() => setUi(prev => ({ ...prev, showMorningModal: false }))}
            theme={currentTheme}
            placeholder={placeholders[ui.currentPlaceholder]}
          />
        )}
      </AnimatePresence>
      
      {/* End-of-Day Reflection Modal */}
      <AnimatePresence>
        {ui.showReflectionModal && (
          <ReflectionModal
            onSubmit={handleSubmitReflection}
            onClose={() => setUi(prev => ({ ...prev, showReflectionModal: false }))}
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
      
      {/* Feedback Modal */}
      <AnimatePresence>
        {ui.showFeedbackModal && (
          <FeedbackModal
            onClose={() => setUi(prev => ({ ...prev, showFeedbackModal: false }))}
            theme={currentTheme}
          />
        )}
      </AnimatePresence>
      
      {/* Header - Desktop Only */}
      <div className="hidden md:block">
        <div className="w-full px-8 py-8">
          <header className="mb-12">
            <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-6">
              <div>
                <div className="flex items-center justify-between md:block">
                  <h1 className="text-3xl font-bold">🧠 DAILY FOCUS OS</h1>
                </div>
                <p style={{ color: currentTheme.muted }} className="mt-2 text-base">
                  "You don't manage tasks. You commit to a day."
                </p>
              </div>
              
              <div className="flex items-center gap-4">
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
                  className="px-4 py-2 border rounded-lg hover:opacity-80 transition-opacity text-sm"
                  title="Switch theme"
                >
                  {settings.theme === 'dark' ? '☀️' : '🌙'}
                </button>
                
                <button
                  onClick={() => setUi(prev => ({ ...prev, showReflectionModal: true }))}
                  style={{ 
                    color: currentTheme.muted,
                    borderColor: currentTheme.border 
                  }}
                  className="px-4 py-2 border rounded-lg hover:opacity-80 transition-opacity text-sm"
                  title="End your day with reflection"
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
                    className="px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity text-sm"
                    title="Unlock full history & insights"
                  >
                    Unlock Pro
                  </button>
                )}
              </div>
            </div>
            
            {/* Stats Grid */}
            <div style={{ borderColor: currentTheme.border }} className="border-t pt-6">
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">{tasksCount.completed}/{tasksCount.total}</div>
                  <div style={{ color: currentTheme.muted }} className="text-sm">Today's tasks</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold">{focusScore}/100</div>
                  <div style={{ color: currentTheme.muted }} className="text-sm">
                    Daily score
                    <div className="text-[10px] mt-0.5 opacity-70">Based on what you finish today</div>
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold">{dayData.focusTime}m</div>
                  <div style={{ color: currentTheme.muted }} className="text-sm">Focus Time</div>
                </div>
              </div>
            </div>
          </header>
          
          {/* Desktop Layout */}
          <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Today's Tasks</h2>
                
                <button
                  onClick={handleAddTask}
                  disabled={tasksCount.total >= 4}
                  style={{ 
                    color: tasksCount.total >= 4 ? currentTheme.muted : currentTheme.accent,
                    opacity: tasksCount.total >= 4 ? 0.5 : 1 
                  }}
                  className={`px-4 py-2 rounded-lg ${tasksCount.total >= 4 ? 'cursor-not-allowed' : 'hover:opacity-80'}`}
                >
                  + Add Task {tasksCount.total}/4
                </button>
              </div>
              
              <div className="space-y-4">
                {dayData.tasks.map((task, index) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={index}
                    onUpdate={handleUpdateTask}
                    onDelete={handleDeleteTask}
                    onToggleComplete={handleToggleComplete}
                    onStartFocus={handleStartFocusMode}
                    theme={currentTheme}
                    isPro={settings.isPro}
                    isMobile={false}
                  />
                ))}
                
                {/* Timeline - Desktop only */}
                <div className="mt-12">
                  <h2 className="text-2xl font-bold mb-6">Daily Timeline</h2>
                  <Timeline
                    tasks={dayData.tasks}
                    theme={currentTheme}
                  />
                </div>
              </div>
            </div>
            
            {/* Right Column */}
            <div className="space-y-6">
              {dayData.morningQuestion && (
                <div style={{ 
                  backgroundColor: currentTheme.surface,
                  borderColor: currentTheme.border
                }} className="border rounded-lg p-6">
                  <h3 className="font-bold mb-2">Today's Focus</h3>
                  <p className="italic">"{dayData.morningQuestion}"</p>
                </div>
              )}
              
              <div style={{ 
                borderColor: currentTheme.border
              }} className="border rounded-lg p-6">
                <h3 className="font-bold mb-4">Focus Actions</h3>
                
                <div className="space-y-3">
                  {dayData.tasks.map(task => (
                    <button
                      key={task.id}
                      onClick={() => handleStartFocusMode(task.id)}
                      disabled={task.completed}
                      style={{ 
                        color: task.completed ? currentTheme.muted : currentTheme.text
                      }}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${task.completed ? 'cursor-not-allowed' : 'hover:bg-opacity-5'}`}
                      title="Work on this without distractions"
                    >
                      <div className="flex justify-between items-center">
                        <span className="truncate">{task.text || 'Untitled'}</span>
                        <span style={{ 
                          color: task.completed ? currentTheme.muted : currentTheme.accent
                        }} className="text-sm">
                          → Focus now
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
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Content */}
      <div className="md:hidden pb-16">
        <div className="px-4 py-6">
          {/* Mobile Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold">🧠 DAILY FOCUS OS</h1>
            <p style={{ color: currentTheme.muted }} className="text-sm mt-1">
              Commit to what matters today
            </p>
          </div>

          {/* Mobile Screen Content */}
          {ui.mobileActiveTab === 'today' && (
            <MobileTodayScreen
              dayData={dayData}
              settings={settings}
              tasksCount={tasksCount}
              focusScore={focusScore}
              currentTheme={currentTheme}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onToggleComplete={handleToggleComplete}
              onStartFocus={handleStartFocusMode}
              onShowReflection={() => setUi(prev => ({ ...prev, showReflectionModal: true }))}
              onShowUpgrade={() => setUi(prev => ({ ...prev, showUpgradeModal: true }))}
              isPro={settings.isPro}
            />
          )}

          {ui.mobileActiveTab === 'focus' && (
            <MobileFocusScreen
              dayData={dayData}
              currentTheme={currentTheme}
              onStartFocus={handleStartFocusMode}
            />
          )}

          {ui.mobileActiveTab === 'progress' && (
            <MobileProgressScreen
              focusScore={focusScore}
              isPro={settings.isPro}
              currentTheme={currentTheme}
              onShowUpgrade={() => setUi(prev => ({ ...prev, showUpgradeModal: true }))}
            />
          )}

          {ui.mobileActiveTab === 'more' && (
            <MobileMoreScreen
              currentTheme={currentTheme}
              onShowUpgrade={() => setUi(prev => ({ ...prev, showUpgradeModal: true }))}
              onShowFeedback={() => setUi(prev => ({ ...prev, showFeedbackModal: true }))}
              onDailyReset={handleDailyReset}
              isPro={settings.isPro}
              theme={settings.theme}
              onToggleTheme={toggleTheme}
            />
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden">
        <BottomNavigation
          activeTab={ui.mobileActiveTab}
          onTabChange={handleTabChange}
          theme={currentTheme}
        />
      </div>
    </div>
  );
}

// ============================================
// SHARED COMPONENTS
// ============================================

function FocusModeView({ task, timer, onStop, theme }: {
  task: Task | undefined;
  timer: number;
  onStop: () => void;
  theme: typeof colorThemes.dark;
}) {
  return (
    <div 
      style={{ backgroundColor: theme.bg }}
      className="min-h-screen w-full flex flex-col items-center justify-center p-4 md:p-8"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md text-center"
      >
        <div style={{ color: theme.accent }} className="text-6xl md:text-8xl font-bold mb-6 md:mb-8">
          {formatTime(timer)}
        </div>
        
        <div className="text-xl md:text-2xl mb-8 md:mb-12 px-4">
          {task?.text || 'Focus Session'}
        </div>
        
        <div className="space-y-4">
          <button
            onClick={onStop}
            style={{ 
              backgroundColor: theme.success,
              color: 'white'
            }}
            className="w-full px-6 py-4 md:px-8 md:py-4 rounded-lg text-lg font-medium hover:opacity-80 transition-opacity"
          >
            Complete Session
          </button>
          
          <p style={{ color: theme.muted }} className="text-sm px-4">
            Everything else is hidden. Just this task.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function TaskCard({ task, index, onUpdate, onDelete, onToggleComplete, onStartFocus, theme, isPro, isMobile }: {
  task: Task;
  index: number;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onStartFocus: (id: string) => void;
  theme: typeof colorThemes.dark;
  isPro: boolean;
  isMobile: boolean;
}) {
  const [isEditing, setIsEditing] = useState(!task.text);
  const [text, setText] = useState(task.text);
  
  const handleSave = () => {
    if (text.trim()) {
      onUpdate(task.id, text);
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
        opacity: task.completed ? 0.6 : 1
      }}
      className="border rounded-lg p-4"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 mr-3">
          <div className="flex items-center mb-2">
            <span style={{ color: theme.muted }} className="mr-3 text-sm">#{index + 1}</span>
            
            {isEditing ? (
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onBlur={handleSave}
                  onKeyPress={handleKeyPress}
                  style={{ 
                    color: task.completed ? theme.muted : theme.text,
                    backgroundColor: 'transparent'
                  }}
                  className="w-full border-b focus:outline-none text-sm"
                  placeholder="What will you work on today?"
                  autoFocus
                />
                <div 
                  style={{ backgroundColor: theme.accent }}
                  className="absolute bottom-0 left-0 right-0 h-0.5 transform scale-x-0 transition-transform duration-200 focus-within:scale-x-100"
                />
              </div>
            ) : (
              <div
                onClick={() => !task.locked && setIsEditing(true)}
                style={{ 
                  color: task.completed ? theme.muted : theme.text,
                  cursor: task.locked ? 'default' : 'pointer'
                }}
                className="flex-1 hover:opacity-80 transition-opacity text-sm"
              >
                {task.text || 'Click to edit...'}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleComplete(task.id)}
            className="relative"
          >
            <div 
              style={{ borderColor: theme.border }}
              className="w-7 h-7 rounded-full border flex items-center justify-center"
            >
              {task.completed && (
                <div 
                  style={{ backgroundColor: theme.success }}
                  className="w-2 h-2 rounded-full"
                />
              )}
            </div>
          </button>
          
          {!task.locked && (
            <button
              onClick={() => onDelete(task.id)}
              style={{ 
                color: theme.muted,
                borderColor: theme.border
              }}
              className="w-7 h-7 flex items-center justify-center rounded-full border hover:opacity-80"
            >
              ×
            </button>
          )}
        </div>
      </div>
      
      {!isMobile && (
        <div className="flex justify-end mt-3">
          <button
            onClick={() => onStartFocus(task.id)}
            disabled={task.completed || task.locked}
            style={{ 
              backgroundColor: task.completed || task.locked ? theme.border : theme.accent,
              color: 'white',
              opacity: task.completed || task.locked ? 0.5 : 1
            }}
            className="px-3 py-1 rounded text-sm font-medium hover:opacity-80 transition-opacity"
            title="Work on this without distractions"
          >
            Focus now
          </button>
        </div>
      )}
      
      {task.locked && (
        <div style={{ color: theme.muted }} className="mt-2 text-xs flex items-center">
          <span className="mr-2">🔒</span>
          Locked (editing breaks focus streak)
        </div>
      )}
    </motion.div>
  );
}

function Timeline({ tasks, theme }: {
  tasks: Task[];
  theme: typeof colorThemes.dark;
}) {
  const hours = Array.from({ length: 12 }, (_, i) => i + 9); // 9 AM to 9 PM
  
  return (
    <div style={{ borderColor: theme.border }} className="border rounded-lg p-4">
      <div className="relative h-64">
        {hours.map(hour => (
          <div
            key={hour}
            className="absolute left-0 right-0"
            style={{ top: `${((hour - 9) / 12) * 100}%` }}
          >
            <div style={{ color: theme.muted }} className="text-xs">
              {hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
            </div>
            <div style={{ borderColor: theme.border }} className="border-t absolute left-12 right-0 top-1/2" />
          </div>
        ))}
        
        {tasks.map(task => {
          if (!task.timeSlot) return null;
          
          const top = ((task.timeSlot.start - 9) / 12) * 100;
          const height = ((task.timeSlot.end - task.timeSlot.start) / 12) * 100;
          
          return (
            <div
              key={task.id}
              style={{ 
                top: `${top}%`,
                height: `${height}%`,
                backgroundColor: task.completed ? 
                  `rgba(107, 191, 156, ${theme === colorThemes.dark ? 0.15 : 0.1})` : 
                  `rgba(79, 140, 255, ${theme === colorThemes.dark ? 0.1 : 0.08})`,
                borderColor: task.completed ? 
                  'rgba(107, 191, 156, 0.3)' : 
                  'rgba(79, 140, 255, 0.3)',
                color: task.completed ? theme.success : theme.accent
              }}
              className="absolute left-12 right-4 rounded-lg p-2 border"
            >
              <div className="font-medium text-sm truncate">{task.text}</div>
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
    <div style={{ borderColor: theme.border }} className="border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">Focus Graph</div>
        {!isPro && <span style={{ color: theme.muted }} className="text-xs">30d</span>}
      </div>
      
      <div className="flex items-end gap-1">
        {days.map((day, index) => (
          <div
            key={day.date}
            className={`w-2 rounded-sm ${index === 29 ? 'ring-1 ring-opacity-30' : ''}`}
            style={{
              height: `${(day.score / 100) * 24}px`,
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

function PlanTodayModal({ onSubmit, onClose, theme, placeholder }: {
  onSubmit: (answer: string) => void;
  onClose: () => void;
  theme: typeof colorThemes.dark;
  placeholder: string;
}) {
  const [answer, setAnswer] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answer.trim()) {
      onSubmit(answer.trim());
    }
  };
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{ 
          backgroundColor: theme.bg,
          borderColor: theme.border
        }}
        className="rounded-xl p-6 w-full max-w-md border relative"
      >
        <button
          onClick={onClose}
          style={{ color: theme.muted }}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:opacity-80 transition-opacity hover:text-white"
          aria-label="Close"
        >
          <span className="text-xl">×</span>
        </button>
        
        <div className="text-center mb-4">
          <div className="text-3xl mb-3">🎯</div>
          <h2 className="text-xl font-bold mb-1">Plan Today in 30 Seconds</h2>
          <p style={{ color: theme.muted }} className="text-sm">
            Pick one thing you want to finish today
          </p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <label className="block mb-4">
            <div className="font-medium mb-2 text-sm">
              What is the ONE thing you want to complete today?
            </div>
            <div className="relative">
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                style={{ 
                  backgroundColor: 'transparent',
                  borderColor: theme.border,
                  color: theme.text
                }}
                className="w-full border rounded-lg p-3 focus:outline-none text-sm"
                placeholder={placeholder}
                autoFocus
              />
              <div 
                style={{ backgroundColor: theme.accent }}
                className="absolute bottom-0 left-3 right-3 h-0.5 transform scale-x-0 transition-transform duration-200 focus-within:scale-x-100"
              />
            </div>
            <p style={{ color: theme.muted }} className="text-xs mt-2">
              Examples: {placeholders.join(", ")}
            </p>
          </label>
          
          <button
            type="submit"
            disabled={!answer.trim()}
            style={{ 
              backgroundColor: answer.trim() ? theme.accent : theme.border,
              color: 'white',
              opacity: answer.trim() ? 1 : 0.5
            }}
            className="w-full py-3 rounded-lg font-medium hover:opacity-80 transition-opacity text-sm"
          >
            Add My First Task
          </button>
        </form>
        
        <p style={{ color: theme.muted }} className="text-xs text-center mt-3">
          Keep it simple. You can add up to 3 tasks total.
        </p>
      </motion.div>
    </div>
  );
}

function ReflectionModal({ onSubmit, onClose, theme }: {
  onSubmit: (reflection: string) => void;
  onClose: () => void;
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
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{ 
          backgroundColor: theme.surface,
          borderColor: theme.border
        }}
        className="rounded-xl p-6 w-full max-w-md border relative"
      >
        <button
          onClick={onClose}
          style={{ color: theme.muted }}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:opacity-80 transition-opacity hover:text-black"
          aria-label="Close"
        >
          <span className="text-xl">×</span>
        </button>
        
        <div className="text-center mb-4">
          <div className="text-3xl mb-3">🌙</div>
          <h2 className="text-xl font-bold mb-1">End of Day Reflection</h2>
          <p style={{ color: theme.muted }} className="text-sm">
            Close your day with awareness
          </p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <label className="block mb-4">
            <div className="font-medium mb-2 text-sm">
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
              className="w-full rounded-lg p-3 focus:outline-none resize-none text-sm"
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
            className="w-full py-3 rounded-lg font-medium hover:opacity-80 transition-opacity text-sm"
          >
            Complete Day
          </button>
        </form>
        
        <p style={{ color: theme.muted }} className="text-xs text-center mt-3">
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
    '4th task slot (Deep Work)',
    'Full-year focus graph history',
    'Weekly focus insights & analytics',
    'Premium themes',
    'Streak protection & recovery',
    'Advanced time blocking'
  ];
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{ 
          backgroundColor: theme.surface,
          borderColor: theme.border
        }}
        className="rounded-xl p-6 w-full max-w-lg border relative"
      >
        <button
          onClick={onClose}
          style={{ color: theme.muted }}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:opacity-80 transition-opacity hover:text-black"
          aria-label="Close"
        >
          <span className="text-xl">×</span>
        </button>
        
        <div className="text-center mb-6">
          <div className="text-3xl mb-3">🚀</div>
          <h2 className="text-2xl font-bold mb-1">Unlock Pro</h2>
          <p style={{ color: theme.muted }} className="text-sm">
            Unlock your full focus potential
          </p>
        </div>
        
        <div className="mb-6">
          <div className="text-center mb-4">
            <span className="text-4xl font-bold">$7</span>
            <span style={{ color: theme.muted }}>/month</span>
          </div>
          
          <div className="space-y-2 mb-4">
            {proFeatures.map((feature, index) => (
              <div key={index} className="flex items-center text-sm">
                <span style={{ color: theme.success }} className="mr-2">✓</span>
                <span>{feature}</span>
              </div>
            ))}
          </div>
          
          <div style={{ 
            backgroundColor: theme.accentSoft,
            color: theme.accent
          }} className="rounded-lg p-3 mb-4">
            <div className="font-medium mb-1 text-sm">Early Lifetime Offer</div>
            <div style={{ color: theme.muted }} className="text-xs">
              First 1000 users: $49 one-time payment
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <button
            onClick={onClose}
            style={{ 
              backgroundColor: theme.accent,
              color: 'white'
            }}
            className="w-full py-3 rounded-lg font-medium hover:opacity-80 transition-opacity text-sm"
          >
            Unlock Pro - $7/month
          </button>
          
          <button
            onClick={onClose}
            style={{ 
              borderColor: theme.border,
              color: theme.text
            }}
            className="w-full py-3 rounded-lg border font-medium hover:opacity-80 transition-opacity text-sm"
          >
            Maybe Later
          </button>
        </div>
        
        <p style={{ color: theme.muted }} className="text-xs text-center mt-4">
          Free forever remains fully functional with 3 tasks
        </p>
      </motion.div>
    </div>
  );
}

function FeedbackModal({ onClose, theme }: {
  onClose: () => void;
  theme: typeof colorThemes.dark;
}) {
  const [message, setMessage] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      const emailBody = `Feedback from Daily Focus OS: ${message}`;
      const mailtoLink = `mailto:shivakushwah144@gmail.com?subject=Daily%20Focus%20OS%20Feedback&body=${encodeURIComponent(emailBody)}`;
      window.location.href = mailtoLink;
      onClose();
    }
  };
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{ 
          backgroundColor: theme.surface,
          borderColor: theme.border
        }}
        className="rounded-xl p-6 w-full max-w-md border relative"
      >
        <button
          onClick={onClose}
          style={{ color: theme.muted }}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:opacity-80 transition-opacity hover:text-black"
          aria-label="Close"
        >
          <span className="text-xl">×</span>
        </button>
        
        <div className="text-center mb-4">
          <div className="text-3xl mb-3">💡</div>
          <h2 className="text-xl font-bold mb-1">Feature Request</h2>
          <p style={{ color: theme.muted }} className="text-sm">
            What would make Daily Focus OS better?
          </p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <label className="block mb-4">
            <div className="font-medium mb-2 text-sm">
              Your idea or feedback
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{ 
                backgroundColor: theme.accentSoft,
                borderColor: 'transparent',
                color: theme.text
              }}
              className="w-full rounded-lg p-3 focus:outline-none resize-none text-sm"
              rows={4}
              placeholder="I wish the app could..."
              autoFocus
            />
          </label>
          
          <div className="space-y-2">
            <button
              type="submit"
              disabled={!message.trim()}
              style={{ 
                backgroundColor: message.trim() ? theme.accent : theme.border,
                color: 'white',
                opacity: message.trim() ? 1 : 0.5
              }}
              className="w-full py-3 rounded-lg font-medium hover:opacity-80 transition-opacity text-sm"
            >
              Send Feedback ✉️
            </button>
            
            <button
              type="button"
              onClick={onClose}
              style={{ 
                borderColor: theme.border,
                color: theme.text
              }}
              className="w-full py-3 rounded-lg border font-medium hover:opacity-80 transition-opacity text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
        
        <p style={{ color: theme.muted }} className="text-xs text-center mt-4">
          We read every suggestion. Your email won't be shown publicly.
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