import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({
  isDark: true,
  toggle: () => {},
  isStudentMode: true,
  toggleMode: () => {},
});

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('securetrail-theme');
    return saved !== null ? saved === 'dark' : true; // dark by default
  });

  const [isStudentMode, setIsStudentMode] = useState(() => {
    const saved = localStorage.getItem('securetrail-mode');
    return saved !== null ? saved === 'student' : true; // student by default
  });

  useEffect(() => {
    localStorage.setItem('securetrail-theme', isDark ? 'dark' : 'light');
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem('securetrail-mode', isStudentMode ? 'student' : 'professional');
  }, [isStudentMode]);

  return (
    <ThemeContext.Provider value={{
      isDark,
      toggle: () => setIsDark(d => !d),
      isStudentMode,
      toggleMode: () => setIsStudentMode(m => !m),
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
