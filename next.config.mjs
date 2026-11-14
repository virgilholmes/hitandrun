const backend = process.env.SHR_BACKEND_URL || 'http://127.0.0.1:8080';
export default {
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
      { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
    ] }];
  },
  async rewrites() {
    return [
      { source: '/assets/:path*', destination: `${backend}/assets/:path*` },
      { source: '/api/game-status', destination: `${backend}/api/game-status` },
    ];
  },
};
