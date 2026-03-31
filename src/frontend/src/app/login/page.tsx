"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(loginId, password);
      router.push("/leads");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>SFA CRM</h1>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login">账号</label>
            <input
              id="login"
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              required
              autoComplete="username"
            />
          </div>
          <div className="field">
            <label htmlFor="password">密码</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? "登录中…" : "登录"}
          </button>
        </form>
      </div>

      <style jsx>{`
        .login-page {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: var(--color-bg);
        }
        .login-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: 40px 32px;
          width: 360px;
        }
        h1 {
          font-size: 22px;
          font-weight: 600;
          margin-bottom: 28px;
          text-align: center;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 16px;
        }
        label {
          font-size: 13px;
          color: var(--color-text-secondary);
        }
        input {
          padding: 8px 12px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          font-size: 14px;
          outline: none;
        }
        input:focus {
          border-color: var(--color-primary);
        }
        .error {
          color: #e53e3e;
          font-size: 13px;
          margin-bottom: 12px;
        }
        button {
          width: 100%;
          padding: 10px;
          background: var(--color-primary);
          color: #fff;
          border: none;
          border-radius: var(--radius);
          font-size: 14px;
          cursor: pointer;
        }
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
