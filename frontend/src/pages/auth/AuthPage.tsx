import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { login } from "@/api/auth";
import { register as registerApi } from "@/api/auth";
import { useAuth } from "@/context/AuthContext";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const detail = (error as { response?: { data?: { detail?: unknown } } })
      .response?.data?.detail;
    if (typeof detail === "string") return detail;
  }

  return fallback;
}

function LebidBrand() {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div
        aria-hidden="true"
        className="relative flex size-12 items-center justify-center rounded-2xl bg-[#fbb02d] text-[#03045e] shadow-[0_8px_18px_rgba(251,176,45,0.28)] ring-1 ring-[#e9a21f]"
      >
        <span className="-mt-0.5 text-[26px] font-extrabold leading-none">L</span>
        <span className="absolute bottom-2 left-3 h-1 w-3 rounded-full bg-[#00b4d8]" />
        <span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-white bg-[#00b4d8]" />
      </div>
      <div className="text-left">
        <p className="text-lg font-bold leading-tight tracking-[0.01em] text-white drop-shadow-sm">
          Lebid
        </p>
        <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/80">
          Your academic companion
        </p>
      </div>
    </div>
  );
}

export default function AuthPage({ initialMode }: { initialMode: "login" | "register" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const [isSignUp, setIsSignUp] = useState(initialMode === "register");
  const [serverError, setServerError] = useState<string | null>(null);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });
  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  useEffect(() => {
    const nextMode = location.pathname === "/register";
    setIsSignUp(nextMode);
    setServerError(null);
  }, [location.pathname]);

  const switchMode = (nextMode: boolean) => {
    setIsSignUp(nextMode);
    setServerError(null);
    navigate(nextMode ? "/register" : "/login");
  };

  const onLogin = async (data: LoginFormData) => {
    setServerError(null);
    try {
      const user = await login(data);
      setUser(user);
      navigate("/dashboard");
    } catch (error: unknown) {
      setServerError(getErrorMessage(error, "Invalid email or password."));
    }
  };

  const onRegister = async (data: RegisterFormData) => {
    setServerError(null);
    try {
      await registerApi({
        name: data.name,
        email: data.email,
        password: data.password,
      });
      const user = await login({ email: data.email, password: data.password });
      setUser(user);
      navigate("/dashboard");
    } catch (error: unknown) {
      setServerError(
        getErrorMessage(error, "Registration failed. Please try again."),
      );
    }
  };

  const inputClassName =
    "my-1.5 w-full rounded-lg border border-[#d1e8f0] bg-[#f4fbff] px-4 py-3 text-sm text-[#03045e] outline-none transition placeholder:text-[#456476] focus:border-[#00b4d8] focus:bg-white focus:ring-2 focus:ring-[#00b4d8]/15";
  const submitClassName =
    "mt-3 rounded-full border border-[#023eba] bg-[#023eba] px-11 py-3 text-[13px] font-semibold uppercase tracking-wider text-white shadow-[0_8px_18px_rgba(2,62,186,0.2)] transition hover:border-[#0077b6] hover:bg-[#0077b6] active:scale-95 disabled:cursor-wait disabled:opacity-70";
  const authPanelStyle = {
    backgroundImage: "url('/background.png')",
  };
  const serverErrorBlock = serverError && (
    <p role="alert" className="mt-2 w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left text-xs text-red-700">
      {serverError}
    </p>
  );

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-cover bg-center bg-no-repeat p-4 font-[Montserrat,sans-serif] text-[#03045e]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(3, 4, 94, 0.36), rgba(3, 4, 94, 0.36)), url('/graduation-background.jpg')",
      }}
    >
      <section className="relative min-h-[540px] w-full max-w-[940px] overflow-hidden rounded-2xl border border-[#d1e8f0] bg-[#03045e] shadow-[0_24px_70px_rgba(3,4,94,0.28)] sm:min-h-[560px]">
        <div
          aria-hidden={!isSignUp}
          inert={!isSignUp}
          className={`absolute inset-0 z-0 flex h-full w-full items-center justify-center transition-all duration-[600ms] ease-in-out sm:left-0 sm:w-1/2 ${
            isSignUp
              ? "opacity-100 sm:z-50 sm:translate-x-full"
              : "pointer-events-none hidden opacity-0 sm:block sm:z-10 sm:translate-x-0"
          }`}
        >
          <form
            onSubmit={registerForm.handleSubmit(onRegister)}
            className="flex h-full w-full flex-col items-center justify-center overflow-y-auto bg-cover bg-center bg-no-repeat px-7 py-8 text-center sm:px-10 md:px-12"
            style={authPanelStyle}
          >
            <LebidBrand />
            <h1 className="mb-2 text-[26px] font-bold text-white drop-shadow-[0_1px_3px_rgba(3,4,94,0.95)] sm:text-[28px]">
              Create Account
            </h1>
            <p className="mb-3 text-[13px] text-white drop-shadow-[0_1px_3px_rgba(3,4,94,0.95)]">
              Use your email to get started
            </p>

            <input
              type="text"
              autoComplete="name"
              placeholder="Name"
              aria-label="Name"
              className={inputClassName}
              {...registerForm.register("name")}
            />
            {registerForm.formState.errors.name && (
              <p className="w-full text-left text-xs text-red-600">
                {registerForm.formState.errors.name.message}
              </p>
            )}

            <input
              type="email"
              autoComplete="email"
              placeholder="Email"
              aria-label="Email"
              className={inputClassName}
              {...registerForm.register("email")}
            />
            {registerForm.formState.errors.email && (
              <p className="w-full text-left text-xs text-red-600">
                {registerForm.formState.errors.email.message}
              </p>
            )}

            <input
              type="password"
              autoComplete="new-password"
              placeholder="Password"
              aria-label="Password"
              className={inputClassName}
              {...registerForm.register("password")}
            />
            {registerForm.formState.errors.password && (
              <p className="w-full text-left text-xs text-red-600">
                {registerForm.formState.errors.password.message}
              </p>
            )}

            <input
              type="password"
              autoComplete="new-password"
              placeholder="Confirm password"
              aria-label="Confirm password"
              className={inputClassName}
              {...registerForm.register("confirmPassword")}
            />
            {registerForm.formState.errors.confirmPassword && (
              <p className="w-full text-left text-xs text-red-600">
                {registerForm.formState.errors.confirmPassword.message}
              </p>
            )}

            {serverErrorBlock}

            <button
              type="submit"
              disabled={registerForm.formState.isSubmitting}
              className={submitClassName}
            >
              {registerForm.formState.isSubmitting ? "Creating account..." : "Sign Up"}
            </button>
              <p className="mt-5 text-sm text-white/90 sm:hidden">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode(false)}
                className="font-semibold text-[#caf0f8] underline underline-offset-2"
              >
                Sign in
              </button>
            </p>
          </form>
        </div>

        <div
          aria-hidden={isSignUp}
          inert={isSignUp}
          className={`absolute inset-0 z-20 flex h-full w-full items-center justify-center transition-all duration-[600ms] ease-in-out sm:left-0 sm:w-1/2 ${
            isSignUp
              ? "pointer-events-none hidden opacity-0 sm:block sm:translate-x-full"
              : "opacity-100 sm:translate-x-0"
          }`}
        >
          <form
            onSubmit={loginForm.handleSubmit(onLogin)}
            className="flex h-full w-full flex-col items-center justify-center overflow-y-auto bg-cover bg-center bg-no-repeat px-7 py-8 text-center sm:px-10 md:px-12"
            style={authPanelStyle}
          >
            <LebidBrand />
            <h1 className="mb-2 text-[26px] font-bold text-white drop-shadow-[0_1px_3px_rgba(3,4,94,0.95)] sm:text-[28px]">
              Sign in
            </h1>
            <p className="mb-3 text-[13px] text-white drop-shadow-[0_1px_3px_rgba(3,4,94,0.95)]">
              Use your account to continue
            </p>

            <input
              type="email"
              autoComplete="email"
              placeholder="Email"
              aria-label="Email"
              className={inputClassName}
              {...loginForm.register("email")}
            />
            {loginForm.formState.errors.email && (
              <p className="w-full text-left text-xs text-red-600">
                {loginForm.formState.errors.email.message}
              </p>
            )}

            <input
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              aria-label="Password"
              className={inputClassName}
              {...loginForm.register("password")}
            />
            {loginForm.formState.errors.password && (
              <p className="w-full text-left text-xs text-red-600">
                {loginForm.formState.errors.password.message}
              </p>
            )}

            <Link
              to="/login"
              onClick={(event) => event.preventDefault()}
              className="my-2 text-[13px] text-white/90 transition hover:text-[#fbb02d]"
            >
              Forgot your password?
            </Link>

            {serverErrorBlock}

            <button
              type="submit"
              disabled={loginForm.formState.isSubmitting}
              className={submitClassName}
            >
              {loginForm.formState.isSubmitting ? "Signing in..." : "Sign In"}
            </button>
              <p className="mt-5 text-sm text-white/90 sm:hidden">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode(true)}
                className="font-semibold text-[#caf0f8] underline underline-offset-2"
              >
                Sign up
              </button>
            </p>
          </form>
        </div>

        <div
          className={`absolute left-1/2 top-0 z-[100] hidden h-full w-1/2 overflow-hidden transition-transform duration-[600ms] ease-in-out sm:block ${
            isSignUp ? "-translate-x-full" : "translate-x-0"
          }`}
        >
          <div
            className={`relative -left-full h-full w-[200%] bg-gradient-to-br from-[#03045e] via-[#023eba] to-[#0077b6] text-white transition-transform duration-[600ms] ease-in-out ${
              isSignUp ? "translate-x-1/2" : "translate-x-0"
            }`}
          >
            <div
              className={`absolute top-0 flex h-full w-1/2 flex-col items-center justify-center px-7 text-center transition-transform duration-[600ms] ease-in-out md:px-10 ${
                isSignUp ? "translate-x-0" : "-translate-x-[20%]"
              }`}
            >
              <h2 className="mb-4 text-[28px] font-bold">Welcome Back!</h2>
              <p className="mb-8 max-w-[280px] text-sm leading-relaxed">
                To keep connected with us, please log in with your personal info.
              </p>
              <button
                type="button"
                onClick={() => switchMode(false)}
                className="rounded-full border border-[#caf0f8] bg-white/5 px-11 py-3 text-[13px] font-semibold uppercase tracking-wider text-white transition hover:border-[#fbb02d] hover:bg-white/10 active:scale-95"
              >
                Sign In
              </button>
            </div>

            <div
              className={`absolute right-0 top-0 flex h-full w-1/2 flex-col items-center justify-center px-7 text-center transition-transform duration-[600ms] ease-in-out md:px-10 ${
                isSignUp ? "translate-x-[20%]" : "translate-x-0"
              }`}
            >
              <h2 className="mb-4 text-[28px] font-bold">Hello, Friend!</h2>
              <p className="mb-8 max-w-[280px] text-sm leading-relaxed">
                Enter your personal details and start your journey with us.
              </p>
              <button
                type="button"
                onClick={() => switchMode(true)}
                className="rounded-full border border-[#caf0f8] bg-white/5 px-11 py-3 text-[13px] font-semibold uppercase tracking-wider text-white transition hover:border-[#fbb02d] hover:bg-white/10 active:scale-95"
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}