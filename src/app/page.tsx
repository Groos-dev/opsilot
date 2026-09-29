"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const TOKEN_KEY = "opsilot_ops_token";

export default function HomePage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const existing = sessionStorage.getItem(TOKEN_KEY);
    if (existing) router.replace("/ops");
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/ops/overview", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      setError("令牌无效，或服务尚未配置 OPS_API_TOKEN");
      return;
    }
    sessionStorage.setItem(TOKEN_KEY, token);
    router.push("/ops");
  }

  return (
    <main className="shell">
      <p className="muted">x402 settlement · ops co-pilot</p>
      <h1 className="brand">Opsilot</h1>
      <p className="slogan">不仅仅只是结算</p>
      <form className="panel" onSubmit={onSubmit}>
        <label htmlFor="token">运维令牌</label>
        <input
          id="token"
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Bearer token"
          required
        />
        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          <button type="submit">进入运维面</button>
        </div>
        {error ? <p className="danger">{error}</p> : null}
      </form>
    </main>
  );
}
