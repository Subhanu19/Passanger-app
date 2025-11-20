// App.js
import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import AppNavigator from './navigation/AppNavigator';

//it ignores the console errors and warnings only in the production
if (!__DEV__) {
  console.error = () => {};
  console.warn = () => {};
}

export default function App() {
  return (
    <ThemeProvider>
      <AppNavigator />
    </ThemeProvider>
  );
}