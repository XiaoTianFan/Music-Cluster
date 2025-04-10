// Basic type declaration for @saehrimnir/druidjs to satisfy TypeScript
declare module '@saehrimnir/druidjs' {
    // Base class (assuming it exists, or use any)
    export class DR {
        constructor(X: unknown, params?: Record<string, unknown>);
        transform(): Matrix;
        // Add other methods if needed
    }

    // Matrix class
    export class Matrix {
        static from(data: number[][]): Matrix;
        get to2dArray(): number[][];
        // Add other properties/methods if needed (e.g., rows, cols)
        rows: number;
        cols: number;
    }

    // Specific DR methods we use
    export class PCA extends DR {}
    export class TSNE extends DR {}
    export class UMAP extends DR {}

    // Add other exports if used (e.g., distance functions)
} 