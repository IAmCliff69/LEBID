import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Camera } from "lucide-react";
import { validateAvatarFile } from "@/lib/avatar";

import { cn } from "@/lib/utils";


interface AvatarPickerProps {
  file: File | null; // the photo chosen so far
  onSelect: (file: File) => void; // called only for a valid photo
  error?: string | null; // e.g. "Please add a profile photo"
}

// A round "add your photo" button with a live preview.
export default function AvatarPicker({
  file,
  onSelect,
  error,
}: AvatarPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // A temporary link so the chosen photo can be previewed before upload.
  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file]
  );
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    event.target.value = ""; // lets the same file be chosen again
    if (!selected) return;

    const problem = validateAvatarFile(selected);
    if (problem) {
      setLocalError(problem);
      return;
    }

    setLocalError(null);
    onSelect(selected);
  };

  const message = localError ?? error ?? null;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={file ? "Change profile photo" : "Add profile photo"}
        className={cn(
          "group relative flex size-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed bg-muted/40 text-muted-foreground transition",
          "hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          message ? "border-destructive" : "border-input",
          previewUrl && "border-solid border-primary"
        )}
      >
        {previewUrl ? (
          <>
            <img
              src={previewUrl}
              alt="Your chosen profile photo"
              className="size-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition group-hover:opacity-100">
              <Camera className="size-6" />
            </span>
          </>
        ) : (
          <Camera className="size-8" />
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={handleChange}
      />

      <p className="text-xs text-muted-foreground">
        {file ? "Looking good! Tap to change." : "Add your profile photo"}
      </p>

      {message && (
        <p className="text-center text-xs text-destructive" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}