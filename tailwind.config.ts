import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: { colors: { forest: "#244D3A", sage: "#E8F0E9", canvas: "#F7F8F5" } } },
  plugins: []
};
export default config;
