import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

export function useImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload/image", {
        method: "POST",
        body: formData,
        // No Content-Type header so the browser sets the correct boundary
        // No custom fetch used here since it's a multipart form data and our endpoint requires native handling
      });

      if (!res.ok) {
        throw new Error(`Upload failed with status ${res.status}`);
      }

      const data = await res.json();
      return data.url;
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload image. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [toast]);

  return {
    uploadImage,
    isUploading,
  };
}
