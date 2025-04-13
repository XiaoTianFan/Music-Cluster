# MusicCluster: Unsupervised Audio Clustering Web Application

This web application demonstrates and visualizes the process of unsupervised k-means clustering applied to audio files, running entirely in the user's browser. Users can upload their own audio, use provided samples, and interactively explore how audio features are extracted, processed, reduced in dimensionality, and finally clustered.

## ✨ Features

*   **Audio Input:** Upload your own audio files (`.wav`, `.mp3`, etc.) or use the built-in default song examples.
*   **Music Information Retrieval (MIR):** Extracts various audio features using **Essentia.js** running in a Web Worker. Selectable features include MFCCs, energy, entropy, key, spectral characteristics, rhythm, and tonal features.
*   **Data Processing:** Optionally scales numerical features (Standardization or Normalization) using a dedicated Web Worker, intelligently skipping one-hot encoded columns.
*   **Dimensionality Reduction:** Reduces high-dimensional feature vectors to 2D or 3D using **DruidJS** (supporting PCA, t-SNE, UMAP) in a Web Worker.
*   **K-Means Clustering:** Performs k-means clustering on the reduced data points using **TensorFlow.js** in a Web Worker.
*   **Step-by-Step Visualization:** Interactively observe the k-means algorithm's progress: centroid initialization, data point assignment, and centroid updates.
*   **Interactive Scatter Plot:** Visualize the final clusters in a 2D/3D scatter plot (using **Plotly.js**), with points colored by cluster, tooltips showing song titles, zooming, and panning.
*   **New Song Classification (To be implemented):** Upload a new song after training a model to see how it's classified within the existing clusters.
*   **Unique UI/UX:** Features a scifi aesthetic with neon and steam-ish elements, built with **Augmented UI**.

## ⚙️ Technology Stack

*   **Framework:** Next.js/React
*   **Language:** TypeScript
*   **MIR:** Essentia.js (@v0.1.3)
*   **Dimensionality Reduction:** DruidJS
*   **Clustering:** TensorFlow.js (@tensorflow/tfjs)
*   **Visualization:** Plotly.js, 
*   **UI Styling:** Augmented UI, Tailwind CSS
*   **Markdown Rendering:** react-markdown
*   **Concurrency:** Web Workers for computationally intensive tasks (Essentia, DruidJS, TensorFlow.js)
*   **Deployment:** Vercel

## 🚀 Getting Started

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/Music-Cluster.git
    cd Music-Cluster
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    # or
    pnpm install
    ```
3.  **Run the development server:**
    ```bash
    npm run dev
    # or
    yarn dev
    # or
    pnpm dev
    ```
4.  Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📂 Project Structure

```
├── public/
│   ├── audio/         # Default audio samples
│   ├── lib/           # Utility functions, library configurations
│   └── workers/       # Build .js workers
├── src/
│   ├── app/           # Next.js App Router pages (Dashboard)
│   ├── components/    # React components (Controls, Visualizations, UI elements)
│   ├── types/         # TypeScript type definitions
│   └── workers/       # Web Worker scripts in .ts (Essentia, DruidJS, TF.js, Data Processing)
├── eslint.config.mjs  # ESLint configuration
├── next.config.mjs    # Next.js configuration
├── package.json       # Project dependencies and scripts
├── tsconfig.json      # TypeScript configuration
└── README.md          # This file
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 