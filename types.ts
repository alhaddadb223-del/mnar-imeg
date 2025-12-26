
export interface ProcessedImage {
  id: string;
  name: string;
  originalFile: File;
  previewUrl: string;
  processedUrl?: string;
  processedBlob?: Blob;
  status: 'pending' | 'processing' | 'completed' | 'error';
  aiCaption?: string;
  aiTags?: string[];
}

export interface AppConfig {
  prefix: string;
  quality: number;
  enableAI: boolean;
  maxDimension: number;
}

export interface AppState {
  images: ProcessedImage[];
  frameFile: File | null;
  framePreview: string | null;
  isProcessing: boolean;
  processingProgress: number;
  config: AppConfig;
}
