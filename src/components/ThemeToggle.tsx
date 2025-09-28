import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './ui/button';

interface ThemeToggleProps {
  variant?: 'default' | 'icon' | 'switch';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  variant = 'default', 
  size = 'md',
  showLabel = false 
}) => {
  const { theme, toggleTheme } = useTheme();

  if (variant === 'switch') {
    return (
      <div className="flex items-center gap-2">
        {showLabel && (
          <span className="text-sm font-medium text-foreground">
            {theme === 'dark' ? 'Dark' : 'Light'}
          </span>
        )}
        <button
          onClick={toggleTheme}
          className="theme-toggle"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          <div className="theme-toggle-thumb" />
        </button>
      </div>
    );
  }

  if (variant === 'icon') {
    return (
      <Button
        variant="ghost"
        size={size}
        onClick={toggleTheme}
        className="relative overflow-hidden transition-all duration-300 hover:scale-105"
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      >
        <div className="relative">
          <Sun 
            className={`h-4 w-4 transition-all duration-300 ${
              theme === 'dark' 
                ? 'rotate-90 scale-0 opacity-0' 
                : 'rotate-0 scale-100 opacity-100'
            }`} 
          />
          <Moon 
            className={`absolute inset-0 h-4 w-4 transition-all duration-300 ${
              theme === 'dark' 
                ? 'rotate-0 scale-100 opacity-100' 
                : '-rotate-90 scale-0 opacity-0'
            }`} 
          />
        </div>
        {theme === 'dark' && (
          <div className="absolute inset-0 bg-neon-glow/10 rounded animate-pulse" />
        )}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size={size}
      onClick={toggleTheme}
      className={`
        relative overflow-hidden transition-all duration-300 hover:scale-105
        ${theme === 'dark' 
          ? 'border-neon-500/50 bg-dark-card hover:bg-dark-card/80 hover:border-neon-400' 
          : 'border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300'
        }
      `}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <div className="flex items-center gap-2">
        <div className="relative">
          <Sun 
            className={`h-4 w-4 transition-all duration-300 ${
              theme === 'dark' 
                ? 'rotate-90 scale-0 opacity-0' 
                : 'rotate-0 scale-100 opacity-100'
            }`} 
          />
          <Moon 
            className={`absolute inset-0 h-4 w-4 transition-all duration-300 ${
              theme === 'dark' 
                ? 'rotate-0 scale-100 opacity-100 text-neon-400' 
                : '-rotate-90 scale-0 opacity-0'
            }`} 
          />
        </div>
        {showLabel && (
          <span className="text-sm font-medium">
            {theme === 'dark' ? 'Dark' : 'Light'}
          </span>
        )}
      </div>
      {theme === 'dark' && (
        <div className="absolute inset-0 bg-neon-glow/5 rounded animate-pulse" />
      )}
    </Button>
  );
};
