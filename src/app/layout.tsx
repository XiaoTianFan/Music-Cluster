import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from '@vercel/analytics/next';
import DynamicBackground from "@/components/DynamicBackground";
import MobileLayoutWrapper from "@/components/MobileLayoutWrapper";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Define metadata for SEO and sharing
export const metadata: Metadata = {
  title: "MusicCluster - MIR with Unsupervised Music Clustering", // Sets the <title> tag
  description: "Explore unsupervised k-means clustering of audio files based on extracted features. A web application demonstrating MIR, dimensionality reduction, and clustering.", // Sets <meta name="description">
  // You can add more metadata here, like Open Graph tags for social media sharing:
  openGraph: {
    title: "MusicCluster - Unsupervised Audio Clustering",
    description: "Visualize how machine learning can group songs based on their audio characteristics.",
    // Add a URL to an image for social media previews (place the image in /public)
    // images: ['/og-image.png'], 
  },
  // You can also add keywords (though less critical for SEO now)
  keywords: ['audio clustering', 'k-means', 'music information retrieval', 'MIR', 'machine learning', 'Next.js', 'Essentia.js'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="">
      <head>
        <link rel="stylesheet" href="/augmented-ui.min.css" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="fixed top-0 left-0 w-full h-full -z-20 bg-black">
          <DynamicBackground />
          <MobileLayoutWrapper>
              {children}
          </MobileLayoutWrapper>
          <Analytics />
        </div>
      </body>
    </html>
  );
}
