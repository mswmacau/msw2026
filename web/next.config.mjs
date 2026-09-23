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
