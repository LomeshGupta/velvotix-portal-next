/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",

  experimental: {
    serverComponentsExternalPackages: ["googleapis"],
  },

  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
