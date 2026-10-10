import { useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  BarChart2,
  Camera,
  ChevronRight,
  Eye,
  EyeOff,
  FileUp,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import NotificationPreferencesSection from "@/components/settings/NotificationPreferencesSection";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { saveGeminiKey, uploadAvatar } from "@/api/users";
import UserAvatar from "@/components/common/UserAvatar";
import ChangePasswordForm from "@/components/settings/ChangePasswordForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { validateAvatarFile } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import StudyPreferencesSection from "@/components/settings/StudyPreferencesSection";

// Where students create their free Gemini API key
const AI_STUDIO_URL = "https://aistudio.google.com/apikey";

function getErrorMessage(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })
    .response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

// A white card with a title, used for every group of settings.
function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Profile photo
// ---------------------------------------------------------------------------
function ProfilePhotoSection() {
  const { setUser } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // lets the same file be chosen again
    if (!file) return;

    const problem = validateAvatarFile(file);
    if (problem) {
      toast.error("Can't use that photo", { description: problem });
      return;
    }

    setIsUploading(true);
    try {
      const updatedUser = await uploadAvatar(file);
      setUser(updatedUser); // the new photo shows everywhere straight away
      toast.success("Profile photo updated");
    } catch (error) {
      toast.error("Couldn't update your photo", {
        description: getErrorMessage(error, "Please try again."),
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SettingsSection
      title="Profile photo"
      description="This is the picture shown on your dashboard and top bar."
    >
      <div className="flex items-center gap-5">
        <UserAvatar size="xl" />
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
          >
            <Camera className="size-4" />
            {isUploading ? "Uploading..." : "Change photo"}
          </Button>
          <p className="text-xs text-muted-foreground">
            JPEG, PNG or WebP, up to 5 MB.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          onChange={handleFile}
        />
      </div>
    </SettingsSection>
  );
}

// ---------------------------------------------------------------------------
// Shortcuts to other pages
// ---------------------------------------------------------------------------
function SettingsLink({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 rounded-2xl border border-border px-4 py-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function ToolsSection() {
  return (
    <SettingsSection title="Tools">
      <div className="space-y-3">
        <SettingsLink
          to="/timetable-import"
          icon={FileUp}
          title="Import timetable"
          description="Upload a new timetable image or PDF."
        />
        <SettingsLink
          to="/analytics"
          icon={BarChart2}
          title="Analytics"
          description="See your study hours, completed sessions and workload."
        />
      </div>
    </SettingsSection>
  );
}

// ---------------------------------------------------------------------------
// Appearance
// ---------------------------------------------------------------------------
function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ] as const;

  return (
    <SettingsSection
      title="Appearance"
      description="Choose how Lebid looks on this device."
    >
      <div className="grid max-w-sm grid-cols-2 gap-3">
        {options.map((option) => {
          const isSelected = theme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setTheme(option.value)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition-colors",
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              <option.icon className="size-4" />
              {option.label}
            </button>
          );
        })}
      </div>
    </SettingsSection>
  );
}

// ---------------------------------------------------------------------------
// Gemini API key
// ---------------------------------------------------------------------------
function GeminiKeySection() {
  const { user, setUser } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const trimmed = apiKey.trim();
    if (trimmed.length < 20) {
      setError("That looks too short to be a Gemini API key.");
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      // The backend checks the key with Google and only saves it if it works.
      await saveGeminiKey(trimmed);
      if (user) setUser({ ...user, has_gemini_api_key: true });
      setApiKey("");
      toast.success("Gemini API key saved", {
        description: "Lebid's AI will use your new key.",
      });
    } catch (saveError) {
      setError(
        getErrorMessage(
          saveError,
          "We couldn't check your key. Please try again."
        )
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingsSection
      title="AI connection"
      description="Lebid's AI uses your own free Google Gemini key. Paste a new one if yours stops working."
    >
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-sm">
          <span
            className={cn(
              "size-2.5 rounded-full",
              user?.has_gemini_api_key ? "bg-success" : "bg-warning"
            )}
          />
          {user?.has_gemini_api_key
            ? "A Gemini key is saved on your account."
            : "No Gemini key saved yet. The AI features need one."}
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="settings_gemini_key">New Gemini API key</Label>
          <div className="relative">
            <Input
              id="settings_gemini_key"
              type={showKey ? "text" : "password"}
              autoComplete="off"
              placeholder="Paste your key here"
              className="pr-10"
              value={apiKey}
              onChange={(event) => {
                setApiKey(event.target.value);
                setError(null);
              }}
            />
            <button
              type="button"
              onClick={() => setShowKey((value) => !value)}
              aria-label={showKey ? "Hide key" : "Show key"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              {showKey ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || apiKey.trim() === ""}
          >
            {isSaving ? "Checking key..." : "Save key"}
          </Button>
          <a
            href={AI_STUDIO_URL}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary hover:underline"
          >
            Get a key from Google AI Studio
          </a>
        </div>
      </div>
    </SettingsSection>
  );
}

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------
function SignOutSection() {
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  return (
    <SettingsSection title="Sign out">
      <Button type="button" variant="outline" onClick={handleLogout}>
        <LogOut className="size-4" />
        Sign out of Lebid
      </Button>
    </SettingsSection>
  );
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------
export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Settings
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your photo, appearance, security and AI connection.
        </p>
      </div>

      <ProfilePhotoSection />
      <ToolsSection />
      <AppearanceSection />
      <SettingsSection
        title="Study preferences"
        description="Lebid uses these when it builds or adjusts your study plan. Sessions already in your planner aren't changed."
      >
        <StudyPreferencesSection />
      </SettingsSection>

      <SettingsSection
        title="Notifications"
        description="Choose which reminders Lebid creates for you. Turning one off only stops new reminders. Existing ones stay in your list."
      >
        <NotificationPreferencesSection />
      </SettingsSection>
      
      <SettingsSection
        title="Change password"
        description="Update your account password securely."
      >
        <ChangePasswordForm />
      </SettingsSection>

      <GeminiKeySection />
      <SignOutSection />
    </div>
  );
}