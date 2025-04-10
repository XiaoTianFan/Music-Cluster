# About SongCluster

Welcome to SongCluster! This application demonstrates an end-to-end unsupervised machine learning pipeline for audio clustering, running entirely in your browser.

## Project Goal

The primary goal is to provide an interactive and educational tool for visualizing how audio files can be grouped based on their extracted musical features without prior labeling. Users can explore the effects of different feature extraction, dimensionality reduction, and clustering parameters.

## How it Works: The Pipeline

1.  **Audio Input:** You can start with the provided default song excerpts or upload your own audio files.
2.  **Feature Extraction (MIR):** Using **Essentia.js**, the application analyzes the audio waveform to extract various Music Information Retrieval (MIR) features (like MFCCs, Energy, Key, etc.). You can select which features to use. Extracted features are then prepared into a numerical matrix, converting categorical features (like Key) using one-hot encoding. Processing happens in a Web Worker to keep the interface responsive.
3.  **Data Processing (Scaling):** Before reducing dimensions, the numerical matrix (excluding one-hot encoded columns) can be scaled using **Standardization (Z-score)** or **Normalization (Min-Max)**. This step, also running in a Web Worker (`data-processing-worker.ts`), can help improve the performance of subsequent distance-based algorithms.
4.  **Dimensionality Reduction:** The high-dimensional (and potentially scaled) feature vectors are then reduced to 2 or 3 dimensions using **DruidJS**, allowing for visualization. You can choose between PCA, t-SNE, or UMAP algorithms. This also runs in a Web Worker.
5.  **K-Means Clustering:** The reduced data points are clustered using the K-Means algorithm, implemented with **tf-kmeans**. The application allows visualizing the step-by-step process of centroid initialization, point assignment, and centroid updates.
6.  **Visualization:** The entire process is visualized using **Plotly.js** and potentially other charting libraries, showing feature data, the dimensionality reduction space, and the final cluster assignments on an interactive scatter plot.

## Technologies Used

*   **Frontend Framework:** Next.js
*   **MIR Library:** Essentia.js
*   **Data Processing:** Custom logic (Standardization/Normalization) in Web Worker
*   **Dimensionality Reduction:** DruidJS
*   **Clustering:** tf-kmeans (TensorFlow.js)
*   **Visualization:** D3.js, Chart.js, Plotly.js
*   **UI Styling:** augmented-ui, Tailwind CSS
*   **Concurrency:** Web Workers (`essentia-worker.ts`, `data-processing-worker.ts`, `druid-worker.ts`, `kmeans-worker.ts`)

## Author

Xiaotian Fan, an As33 production.

As33 is a group that follows their fundamental principles to donate 1/3 of their dispensible income to the community, focusing on developing human-centered AI applications. 