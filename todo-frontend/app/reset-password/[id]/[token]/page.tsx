"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react"; // Make sure lucide-react is installed

export default function ResetPasswordPage() {
  const router = useRouter();
  const { id, token } = useParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setIsError(false);

    if (password !== confirmPassword) {
      setMessage("Passwords do not match");
      setIsError(true);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`http://localhost:5000/reset-password/${id}/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(data.message);
        setIsError(false);
        setPassword("");
        setConfirmPassword("");

        // Redirect to home/login page after 2.5s
        setTimeout(() => {
          router.push("/");
        }, 2500);
      } else {
        setMessage(data.error || "Something went wrong");
        setIsError(true);
      }
    } catch (err) {
      console.error(err);
      setMessage("Server error");
      setIsError(true);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-100 to-blue-200 p-4">
      <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-6 text-blue-700">
          Reset Password
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* New Password */}
          <label className="font-medium text-gray-700 relative">
            New Password
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full mt-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition pr-10"
              placeholder="Enter new password"
            />
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-500"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </span>
          </label>

          {/* Confirm Password */}
          <label className="font-medium text-gray-700 relative">
            Confirm Password
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full mt-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition pr-10"
              placeholder="Confirm new password"
            />
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-500"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className={`py-3 rounded-lg font-bold text-white transition-colors duration-200 mb-3 ${
              loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"
            }`}
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        {/* Back Button */}
        <button
          onClick={() => router.push("/")}
          className="w-full py-3 rounded-lg text-blue-500 font-semibold border border-blue-500 hover:bg-blue-50 transition mb-2"
        >
          Back to Home
        </button>

        {message && (
          <p
            className={`mt-4 text-center font-medium ${
              isError ? "text-red-600" : "text-green-600"
            }`}
          >
            {message}
          </p>
        )}

        {!isError && message && (
          <p className="mt-2 text-center text-gray-500 text-sm">
            You will be redirected to home shortly...
          </p>
        )}
      </div>
    </div>
  );
}