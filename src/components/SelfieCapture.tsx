import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SelfieCaptureProps {
  onCapture: (blob: Blob) => void;
  onClear: () => void;
}

export function SelfieCapture({ onCapture, onClear }: SelfieCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      });
    } catch {
      setError(
        "Camera indisponivel. Selecione uma foto da galeria.",
      );
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const size = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      video,
      (video.videoWidth - size) / 2,
      (video.videoHeight - size) / 2,
      size,
      size,
      0,
      0,
      480,
      480,
    );
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setPreviewUrl(URL.createObjectURL(blob));
        stopCamera();
        onCapture(blob);
      },
      "image/jpeg",
      0.85,
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const size = Math.min(img.width, img.height);
      ctx.drawImage(
        img,
        (img.width - size) / 2,
        (img.height - size) / 2,
        size,
        size,
        0,
        0,
        480,
        480,
      );
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          URL.revokeObjectURL(url);
          setPreviewUrl(URL.createObjectURL(blob));
          onCapture(blob);
        },
        "image/jpeg",
        0.85,
      );
    };
    img.src = url;
    e.target.value = "";
  };

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError(null);
    onClear();
    startCamera();
  };

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Assinatura facial capturada"
            className="h-full w-full object-cover"
          />
        ) : cameraOn ? (
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full -scale-x-100 object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground">
            <Camera className="h-8 w-8" />
            <p className="text-sm">
              A assinatura facial confirma quem fez o registro
            </p>
          </div>
        )}
        {previewUrl && (
          <div className="absolute right-2 top-2 rounded-full bg-success p-1.5 text-success-foreground">
            <Check className="h-4 w-4" />
          </div>
        )}
      </div>
      {error && (
        <p className="text-center text-sm text-destructive">{error}</p>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="flex justify-center gap-2">
        {previewUrl ? (
          <Button type="button" variant="outline" size="sm" onClick={retake}>
            <RefreshCw className="mr-1 h-4 w-4" /> Refazer
          </Button>
        ) : cameraOn ? (
          <Button type="button" size="sm" onClick={capture}>
            <Camera className="mr-1 h-4 w-4" /> Capturar assinatura facial
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={startCamera}
            >
              <Camera className="mr-1 h-4 w-4" /> Camera
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <Upload className="mr-1 h-4 w-4" /> Galeria
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
