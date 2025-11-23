// constants/Colors.js
export const LightTheme = {
  // Core Brand Colors
  primary: "#D4A53A",      // Muted golden yellow (logo, active tab, buttons)
  secondary: "#FFFFFF",    // Pure white (text on primary, cards)
  background: "#F5E8D6",   // Warm beige background
  
  // Text Colors
  textPrimary: "#333333",  // Charcoal grey (main titles/headers)
  textSecondary: "#5A5A5A",// Dark grey (body text, labels, section headers)
  textTertiary: "#A0A0A0", // Medium grey (placeholder text)
  
  // UI & Border Colors
  uiBackground: "#EDEDED", // Light grey (segmented control background)
  border: "#E0E0E0",       // Light grey border (inputs, dividers)
  borderActive: "#D4A53A", // Golden border (focused inputs)
  
  // Button Gradient Colors
  goldGradientStart: "#E4BC48", // Brighter gold
  goldGradientEnd: "#C99C2E",   // Deeper gold
};

export const DarkTheme = {
  // Core Brand Colors
  primary: "#D4A53A",      // Golden yellow stays consistent
  secondary: "#1E1E1E",    // Dark charcoal (cards)
  background: "#121212",   // Near-black background
  
  // Text Colors
  textPrimary: "#FFFFFF",  // White (main text)
  textSecondary: "#B0B0B0",// Light grey (secondary text)
  textTertiary: "#757575", // Medium grey (placeholder)
  
  // UI & Border Colors
  uiBackground: "#2A2A2A", // Dark grey (UI elements)
  border: "#3A3A3A",       // Dark border
  borderActive: "#D4A53A", // Golden border (active states)
  
  // Button Gradient
  goldGradientStart: "#E4BC48",
  goldGradientEnd: "#C99C2E",
};

export default LightTheme;