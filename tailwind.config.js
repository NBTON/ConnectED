/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.njk",
    "./public/Script/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#E45200",
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};
