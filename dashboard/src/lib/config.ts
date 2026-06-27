export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000",
  // Where the agent installers + install scripts are hosted (your VPS/CDN).
  // Defaults to the API host if not set separately.
  installBase:
    process.env.NEXT_PUBLIC_INSTALL_BASE ??
    process.env.NEXT_PUBLIC_API_URL ??
    "https://YOUR_VPS_DOMAIN",
};
