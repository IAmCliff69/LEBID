import { useRef, useState } from "react";

import { motion, useReducedMotion } from "motion/react";

import {
  ArrowRight,
  FileText,
  Loader2,
  Upload,
  X,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import LebidLogo from "@/components/brand/LebidLogo";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

const ACCEPTED_EXTENSIONS = ".pdf,.jpg,.jpeg,.png";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const friendlyFont = {
  fontFamily: '"Original Surfer", cursive',
};

export default function TimetableUploadPage() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [isPreparing, setIsPreparing] = useState(false);

  const validateFile = (file: File): boolean => {
    setError("");

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Please upload a PDF, JPG, or PNG timetable.");
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(
        "Your timetable is too large. Please upload a file smaller than 10 MB."
      );
      return false;
    }

    return true;
  };

  const handleFile = (file: File) => {
    if (!validateFile(file)) {
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setError("");
  };

  const handleFileInput = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (file) {
      handleFile(file);
    }

    event.target.value = "";
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (
    event: React.DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (
    event: React.DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const removeFile = () => {
    setSelectedFile(null);
    setError("");
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select your timetable first.");
      return;
    }

    setError("");
    setIsPreparing(true);

    /*
     * Actual backend upload integration will be added
     * in the next implementation step.
     */
    await new Promise((resolve) => setTimeout(resolve, 350));

    navigate("/onboarding/timetable-processing", {
      replace: true,
      state: {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.type,
      },
    });
  };

  const handleSkip = () => {
    navigate("/onboarding/study-preferences", {
      replace: true,
    });
  };

  return (
    <main
      className="relative flex min-h-dvh items-center justify-center p-4 sm:p-6"
      style={{
        backgroundImage:
          "linear-gradient(color-mix(in srgb, var(--primary) 40%, transparent), color-mix(in srgb, var(--primary) 40%, transparent)), url('/graduation-background.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <motion.div
        initial={
          shouldReduceMotion
            ? false
            : { opacity: 0, y: 16 }
        }
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.4,
          ease: "easeOut",
        }}
        className="relative my-auto flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        {/* Small logo */}
        <div className="px-6 pt-6 sm:px-8 sm:pt-8">
          <LebidLogo className="w-16 sm:w-20" />
        </div>

        <div className="flex flex-col px-6 pb-8 pt-4 sm:px-8 sm:pb-10">
          {/* Heading */}
          <div className="mb-6 text-center">
            <h1
              className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
              style={friendlyFont}
            >
              Let&apos;s map out your week 🗓️
            </h1>

            <p className="text-sm text-muted-foreground">
              Upload your lecture timetable and let Lebid use AI
              to organize your academic week.
            </p>
          </div>

          {/* Upload area */}
          <div className="w-full">
            {!selectedFile ? (
              <motion.div
                animate={
                  shouldReduceMotion
                    ? undefined
                    : {
                        scale: isDragging ? 1.01 : 1,
                      }
                }
                transition={{ duration: 0.2 }}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() =>
                  fileInputRef.current?.click()
                }
                role="button"
                tabIndex={0}
                aria-label="Upload timetable"
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" ||
                    event.key === " "
                  ) {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={cn(
                  "flex min-h-[230px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all sm:min-h-[250px]",
                  isDragging
                    ? "border-foreground bg-foreground/[0.04]"
                    : "border-border hover:border-foreground/40 hover:bg-muted/30"
                )}
              >
                <div
                  className={cn(
                    "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-colors",
                    isDragging
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Upload
                    className="h-6 w-6"
                    aria-hidden="true"
                  />
                </div>

                <p className="text-sm font-medium text-foreground sm:text-base">
                  Drop your timetable here
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  or
                </p>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="mt-3 inline-flex h-10 items-center justify-center rounded-xl bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-foreground/30 focus:ring-offset-2"
                >
                  UPLOAD TIMETABLE
                </button>

                <p className="mt-4 text-xs text-muted-foreground">
                  PDF • JPG • PNG · Max 10 MB
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_EXTENSIONS}
                  onChange={handleFileInput}
                  className="sr-only"
                />
              </motion.div>
            ) : (
              /* Selected file */
              <motion.div
                initial={
                  shouldReduceMotion
                    ? false
                    : { opacity: 0, scale: 0.98 }
                }
                animate={
                  shouldReduceMotion
                    ? undefined
                    : { opacity: 1, scale: 1 }
                }
                className="rounded-2xl border border-border bg-muted/20 p-5"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
                    <FileText
                      className="h-5 w-5"
                      aria-hidden="true"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {selectedFile.name}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {(
                        selectedFile.size /
                        1024 /
                        1024
                      ).toFixed(2)}{" "}
                      MB · Ready to upload
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={removeFile}
                    disabled={isPreparing}
                    aria-label="Remove selected timetable"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                  >
                    <X
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={isPreparing}
                  className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-foreground/30 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPreparing ? (
                    <>
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      Preparing...
                    </>
                  ) : (
                    <>
                      CONTINUE
                      <ArrowRight
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                    </>
                  )}
                </button>
              </motion.div>
            )}

            {/* Validation error */}
            {error && (
              <p
                role="alert"
                className="mt-3 text-center text-sm text-destructive"
              >
                {error}
              </p>
            )}
          </div>

          {/* Skip */}
          <button
            type="button"
            onClick={handleSkip}
            disabled={isPreparing}
            className="mt-6 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
          >
            Skip for now
          </button>
        </div>
      </motion.div>

      <ThemeToggle />
    </main>
  );
}