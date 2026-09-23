import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // MSW 街健館 品牌色票
        ink: '#0F0F0F', // 主背景 / 深色
        ink2: '#1A1A1A', // 深色卡片
        ink3: '#262626', // 深色描邊
        mist: '#F5F5F7', // 淺色背景
        cobalt: '#0047AB', // 主要藍色（穩定）
        cobaltBright: '#0057FF', // 主要藍色（數位感 / hover）
        energy: '#E3001B', // 強調紅
        energyBright: '#FF2D2D', // 強調紅（hover）
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"',
          '"Noto Sans TC"', '"PingFang TC"', '"Microsoft JhengHei"',
          'Roboto', 'Helvetica', 'Arial', 'sans-serif',
        ],
      },
      container: {
        center: true,
        padding: { DEFAULT: '1.25rem', lg: '2rem' },
        screens: { '2xl': '1280px' },
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'count-loop': {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-50%)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up .7s cubic-bezier(.22,1,.36,1) both',
        marquee: 'marquee 30s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
