import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Track Expenser",
    short_name: "Track Expenser",
    description: "Track your expenses with Track Expenser.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b1220",
    theme_color: "#0b1220",
    icons: [
      {
        src: "/favicon.png",
        sizes: "768x768",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
