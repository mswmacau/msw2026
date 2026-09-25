/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 讓 Docker 映像只打包必要檔案（Dockerfile 使用 standalone 模式）
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  // 安全標頭（CSP 太嚴可能影響 Google 登入，先不加，待實測後再加）
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  // 加快換頁：短時間內回到同一頁直接用快取，不必再等伺服器
  experimental: {
    staleTimes: { dynamic: 30, static: 300 },
  },
  async rewrites() {
    // 沒有設定 WordPress 網址時（例如部署到 Vercel），就不要加 rewrite，否則 build 會失敗
    const wp = process.env.NEXT_PUBLIC_WP_URL || process.env.WP_URL;
    if (!wp || !/^https?:\/\//.test(wp)) return [];
    return [
      {
        source: '/wp-api/:path*',
        destination: `${wp.replace(/\/$/, '')}/wp-json/:path*`,
      },
    ];
  },
};

export default nextConfig;
