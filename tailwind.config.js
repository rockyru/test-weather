module.exports = {
  purge: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      colors: {
        'typhoon-blue': '#1e88e5',
        'earthquake-red': '#e53935',
        'flood-teal': '#26a69a',
        'volcano-orange': '#fb8c00'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
  safelist: [
    'bg-blue-100',
    'border-blue-500',
    'bg-red-100',
    'border-red-500',
    'bg-teal-100',
    'border-teal-500',
    'bg-orange-100',
    'border-orange-500',
  ]
}
