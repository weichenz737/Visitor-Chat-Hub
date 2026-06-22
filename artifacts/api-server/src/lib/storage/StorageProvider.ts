export interface UploadResult {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
}

export interface StorageProvider {
  /** Provider id: local | minio | s3 */
  readonly kind: string;
  uploadImage(file: Express.Multer.File): Promise<UploadResult>;
  uploadFile(file: Express.Multer.File): Promise<UploadResult>;
  resolvePublicUrl(storageKey: string): string;
}
