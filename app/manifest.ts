import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest & {
  share_target?: {
    action: string;
    method: string;
    enctype: string;
    params: {
      title?: string;
      text?: string;
      url?: string;
      files?: Array<{
        name: string;
        accept: string[];
      }>;
    };
  };
} {
  return {
    name: "Track Expenser",
    short_name: "Track Expenser",
    description: "Daily expense & income tracker with Online vs Cash vaults and instant receipt sharing.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      {
        src: "/favicon.png",
        sizes: "768x768",
        type: "image/png",
        purpose: "any",
      },
    ],
    share_target: {
      action: "/share-receipt",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [
          {
            name: "receipt",
            accept: ["image/*", "text/*"],
          },
        ],
      },
    },
  };
}
