"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("http://localhost:5000/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("user_id", data.user.id.toString());
      localStorage.setItem("role", data.user.role);

      const role = data.user.role?.toLowerCase().trim();
      router.push(role === "admin" ? "/admin/dashboard" : "/dashboard");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = "http://localhost:5000/auth/google";
  };

  useEffect(() => {
    const googleUser = searchParams.get("user");
    if (!googleUser) return;

    try {
      const parsedUser = JSON.parse(decodeURIComponent(googleUser));
      localStorage.setItem("user", JSON.stringify(parsedUser));
      localStorage.setItem("user_id", parsedUser.id.toString());
      localStorage.setItem("role", parsedUser.role || "user");

      const role = parsedUser.role?.toLowerCase().trim();
      router.replace(role === "admin" ? "/admin/dashboard" : "/dashboard");
    } catch {
      setError("Google login failed. Please try again.");
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-r from-blue-200 to-purple-200 p-4">
      <div className="bg-white shadow-2xl rounded-3xl w-full max-w-md p-8">
        <h1 className="text-3xl font-bold text-center text-blue-700 mb-6">
          Welcome Back
        </h1>

        {error && (
          <p className="text-red-600 text-center mb-4 font-medium">{error}</p>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <label className="font-semibold text-gray-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full mt-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              placeholder="Enter your email"
            />
          </label>

          <label className="font-semibold text-gray-700 relative">
            Password
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full mt-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition pr-10"
              placeholder="Enter your password"
            />
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-500"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </span>
          </label>

          <button
            type="submit"
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg transition"
          >
            Login
          </button>
        </form>

        <button
          onClick={handleGoogleLogin}
          className="w-full mt-3 py-3 bg-[#DB4437] hover:bg-[#C1351D] text-white font-medium rounded-lg flex items-center justify-center transition"
        >
          Continue with Google
        </button>

        <div className="flex justify-between mt-4 text-sm items-center">
          <button
            onClick={() => router.push("/forgot-password")}
            className="text-blue-600 hover:underline font-medium"
          >
            Forgot Password?
          </button>

          <p className="text-gray-600">
            No account yet?{" "}
            <span
              onClick={() => router.push("/register")}
              className="text-blue-600 hover:underline cursor-pointer font-medium"
            >
              Register
            </span>
          </p>
        </div>

        <div className="mt-6 text-center text-gray-400 text-xs">
          &copy; 2025 Zenlist. All rights reserved.
        </div>
      </div>
    </div>
  );
}