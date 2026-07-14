MusicCluster is an in-browser Music Information Retrieval (MIR) workspace with two related machine-learning modes. **Cluster mode** discovers groups without labels. **Neural Network mode** learns user-defined labels and predicts them with a multilayer perceptron (MLP). Use the icon beside the page title to switch modes.

Audio analysis and model work stay in the browser. Web Workers perform the expensive feature, processing, reduction, clustering, and neural-network operations so the interface remains usable during longer runs.

## Cluster Mode: Unsupervised Discovery

Cluster mode is useful when you want the data to reveal its own groupings.

1. **Choose audio:** Start with the bundled excerpts, enable or disable songs in the Song Pool, or upload local audio.
2. **Extract MIR features:** Select descriptors such as MFCC, energy, key, rhythm, spectral shape, or intensity. Essentia.js analyzes each waveform and categorical values are converted into numerical columns.
3. **Process the matrix:** Choose standardization, min-max normalization, or no scaling. One-hot encoded columns remain categorical.
4. **Reduce dimensions:** Project the feature matrix to 2D or 3D with PCA, UMAP, or t-SNE for inspection and clustering.
5. **Run K-Means:** Select the number of clusters, initialize centroids, and advance the assignment/update cycle step by step or run it continuously.
6. **Inspect the result:** Color the Plotly visualization by cluster or feature, compare points and centroids, play songs, and open waveform, spectrogram, and raw-feature details.

Cluster assignments describe similarity in the selected feature space. They are not genre labels unless you interpret and name them that way.

## Neural Network Mode: Supervised Classification

Neural Network mode is useful when you already know the categories you want the model to learn.

1. **Label the training data:** Create at least two labels and drag songs into their columns. Each active label needs at least two usable songs. Uploaded training songs remain local to the current browser session unless their setup metadata is exported.
2. **Extract MIR features:** Select the model inputs and prepare a feature matrix from the labeled songs. Cached features accelerate the bundled excerpts; uploaded files are analyzed locally.
3. **Choose data processing:** Select standardization, min-max normalization, or **None**, then process the matrix. Changing this choice invalidates stale processed or reduced output so the next model uses the visible configuration.
4. **Choose dimensionality reduction:** Select **None** to train on the prepared matrix, or use PCA, UMAP, or t-SNE with a 2D or 3D target. Changing the algorithm or target clears stale projections.
5. **Configure the MLP:** Set hidden layers, nodes, activation, optimizer, learning rate, epochs, split ratio, seed, batch size, and an optional target loss.
6. **Train and inspect:** Train in the TensorFlow.js worker. The interface reports label readiness, training summary, feature signal, network structure and activations, plus full-size training/validation loss and accuracy charts.
7. **Infer labels:** Predict the prepared dataset and review accuracy, confidence, confusion, and per-label metrics. You can also classify one uploaded audio file when its feature pipeline can reproduce the trained input shape.
8. **Validate and compare:** Run the suggested holdout, stratified k-fold, or leave-one-out validation. Comparison history ranks raw, processed, and reduced runs; runs can be reviewed, annotated, exported, imported, or deleted individually.
9. **Explain and reuse:** Permutation-based feature impact identifies influential inputs. Export labels and setup for another session, or export the trained model with its preprocessing context for later inference.

## Reduction and Inference Constraints

PCA learns a reusable linear projection and is supported for reduced uploaded-audio inference. The current ANN workflow does not reuse t-SNE or UMAP projections for a new standalone song, so uploaded inference is blocked for models trained with those reducers. Dataset inference remains available when the current matrix matches the trained pipeline. Retrain after changing features, processing, reduction, labels, or network structure.

## Main Technologies

- **Application:** Next.js, React, TypeScript, Tailwind CSS, augmented-ui
- **Audio and MIR:** Essentia.js, WaveSurfer.js
- **Machine learning:** TensorFlow.js, tf-kmeans, DruidJS
- **Visualization:** Plotly.js, D3.js, Chart.js
- **Concurrency:** Dedicated browser workers for feature extraction, processing, reduction, K-Means, and MLP operations

## Author

[Xiaotian Fan](https://xiaotianfanx.com)
