Welcome to MusicCluster! This application demonstrates an end-to-end unsupervised machine learning pipeline for audio clustering, running entirely in your browser.

## Project Goal

The primary goal is to provide an interactive and educational tool for visualizing how audio files can be grouped based on their extracted musical features without prior labeling. Users can explore the effects of different feature extraction, dimensionality reduction, and clustering parameters.

## How it Works: The Pipeline

1.  **Audio Input:** You can start with the provided default song excerpts or upload your own audio files.
2.  **Feature Extraction (MIR):** Using **Essentia.js**, the application analyzes the audio waveform to extract various Music Information Retrieval (MIR) features (like MFCCs, Energy, Key, etc.). You can select which features to use. Extracted features are then prepared into a numerical matrix, converting categorical features (like Key) using one-hot encoding. Processing happens in a Web Worker to keep the interface responsive.
3.  **Data Processing (Scaling):** Before reducing dimensions, the numerical matrix (excluding one-hot encoded columns) can be scaled using **Standardization (Z-score)** or **Normalization (Min-Max)**. This step, also running in a Web Worker (`data-processing-worker.ts`), can help improve the performance of subsequent distance-based algorithms.
4.  **Dimensionality Reduction:** The high-dimensional (and potentially scaled) feature vectors are then reduced to 2 or 3 dimensions using **DruidJS**, allowing for visualization. You can choose between PCA, t-SNE, or UMAP algorithms. This also runs in a Web Worker.
5.  **K-Means Clustering:** The reduced data points are clustered using the K-Means algorithm, implemented with **tf-kmeans**. The application allows visualizing the step-by-step process of centroid initialization, point assignment, and centroid updates.
6.  **Data Visualization:** The entire process is visualized using **Plotly.js** and potentially other charting libraries, showing feature data, the dimensionality reduction space, and the final cluster assignments on an interactive scatter plot.
7.  **Audio Visualization:** View detailed waveform and spectrogram visualizations for each song, with interactive playback controls and logarithmic frequency scaling for better frequency analysis.

## Technologies Used

*   **Frontend Framework:** Next.js
*   **MIR Library:** Essentia.js
*   **Data Processing:** Custom logic (Standardization/Normalization) in Web Worker
*   **Dimensionality Reduction:** DruidJS
*   **Clustering:** tf-kmeans (TensorFlow.js)
*   **Visualization:** D3.js, Chart.js, Plotly.js, WaveSurfer.js
*   **UI Styling:** augmented-ui, Tailwind CSS
*   **Concurrency:** Web Workers (`essentia-worker.ts`, `data-processing-worker.ts`, `druid-worker.ts`, `kmeans-worker.ts`)

## Dimensionality Reduction & Inference Caveats

Not every dimensionality reduction technique behaves the same way once you try to embed a *new* song after training:

* **PCA** is linear and yields an explicit projection matrix. We can multiply any new (processed) feature vector by that matrix and land it in the same coordinate system, so inference is deterministic and fast.
* **UMAP** preserves a neighbor graph of the training data. Its implementation in DruidJS exposes an approximate `transform` that inserts new points by comparing them to that fixed graph, so inference is feasible as long as we keep the fitted structure around.
* **t-SNE** optimizes all points jointly and does not learn a reusable transform. Adding even a single new song forces the entire layout to be recomputed, which would invalidate the saved clusters/centroids. In practice this manifests as new songs collapsing near the origin or drifting away from the trained clusters, so the UI blocks inference whenever the reduction step used t-SNE. Use PCA or UMAP (or retrain reduction + clustering with the new song included) when you need inference.

## Author

[Xiaotian Fan](https://xiaotianfanx.com)