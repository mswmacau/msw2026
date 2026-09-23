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
    return [
      {
        source: '/wp-api/:path*',
        destination: `${process.env.NEXT_PUBLIC_WP_URL}/wp-json/:path*`,
      },
    ];
  },
};

export default nextConfig;
