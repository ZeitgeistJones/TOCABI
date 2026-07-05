import type { Metadata } from "next";

// Resolution order:
//   1. `NEXT_PUBLIC_PRODUCTION_URL` — explicit override at build time
//   2. `VERCEL_PROJECT_PRODUCTION_URL` — automatic Vercel preview/production URL
//   3. `https://tocabi.xyz` — stable fallback for IPFS-hosted builds
const productionUrl = process.env.NEXT_PUBLIC_PRODUCTION_URL
  ? process.env.NEXT_PUBLIC_PRODUCTION_URL
  : process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://tocabi.xyz";

const titleTemplate = "%s | TOCABI";

export const getMetadata = ({
  title,
  description,
  imageRelativePath = "/og.png",
}: {
  title: string;
  description: string;
  imageRelativePath?: string;
}): Metadata => {
  const imageUrl = `${productionUrl}${imageRelativePath}`;

  return {
    metadataBase: new URL(productionUrl),
    title: {
      default: title,
      template: titleTemplate,
    },
    description: description,
    openGraph: {
      title: {
        default: title,
        template: titleTemplate,
      },
      description: description,
      images: [
        {
          url: imageUrl,
        },
      ],
    },
    twitter: {
      title: {
        default: title,
        template: titleTemplate,
      },
      description: description,
      images: [imageUrl],
    },
    icons: {
      icon: [
        {
          url: "/favicon.svg",
          type: "image/svg+xml",
        },
      ],
    },
  };
};
