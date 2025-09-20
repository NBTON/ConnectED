/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.njk",
    "./public/Script/**/*.js",
  ],
  safelist: [
    'bg-primary',
    'text-primary',
    'btn-primary',
    'bg-accent',
    'text-accent'
  ],
  theme: {
    darkMode: 'class',
    extend: {
      colors: {
        // Primary colors from design system
        indigo: {
          500: '#4F46E5',
          600: '#4338CA',
          700: '#3730A3',
        },
        teal: {
          500: '#0D9488',
          600: '#0F766E',
          700: '#115E59',
        },
        coral: {
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
        },
        // Neutral colors
        background: '#F8FAFC',
        textPrimary: '#1E293B',
        textSecondary: '#64748B',
        white: '#FFFFFF',
        error: '#EF4444',
        success: '#10B981',
        warning: '#F59E0B',
        // Preserve existing color names for backward compatibility
        primary: '#4F46E5',
        secondary: '#0D9488',
        neutral: '#F8FAFC',
      },
      fontFamily: {
        sans: ['Open Sans', 'sans-serif'],
        body: ['Open Sans', 'sans-serif'],
        heading: ['Inter', 'sans-serif'],
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        '2xl': '48px',
        '3xl': '64px',
      },
      borderRadius: {
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
      },
      boxShadow: {
        'sm': '0 1px 2px rgba(0, 0, 0, 0.05)',
        'md': '0 4px 6px rgba(0, 0, 0, 0.05)',
        'lg': '0 10px 15px rgba(0, 0, 0, 0.1)',
        'xl': '0 20px 25px rgba(0, 0, 0, 0.1)',
      },
      screens: {
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      extend: {
        ringColor: {
          DEFAULT: '#4F46E5',
        },
        ringOffsetColor: {
          DEFAULT: '#FFFFFF',
        },
        ringOffsetWidth: {
          DEFAULT: '2px',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};
