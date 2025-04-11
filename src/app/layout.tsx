import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from '@vercel/analytics/next';
import "./globals.css";
import "augmented-ui/augmented-ui.min.css";

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
  title: "MusicCluster - Unsupervised Audio Clustering", // Sets the <title> tag
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
