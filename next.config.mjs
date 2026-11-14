/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The agent used to have its own page. It now lives on the front page and
  // under every chart; old links land on the front page.
  async redirects() {
    return [{ source: "/agent", destination: "/", permanent: false }];
  },
};

export default nextConfig;
