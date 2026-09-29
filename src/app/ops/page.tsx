"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const TOKEN_KEY = "opsilot_ops_token";

type Overview = {
  network: string;
  wallet: {
    address: string;
    gasBalanceAvax: number;
    alertThresholdAvax: number;
    low: boolean;
  };
  rpcOk: boolean;
  settlements: Array<{
    payment_key: string;
    status: string;
    tx_hash: string | null;
    amount: string;
    asset: string;
    error_reason: string | null;
    updated_at: string;
  }>;
};

type PilotReport = {
  summary: string;
  priorities: Array<{
    severity: string;
    topic: string;
    evidence: string;
    recommendation: string;
  }>;
};

export default function OpsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [pilot, setPilot] = useState<PilotReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const value = sessionStorage.getItem(TOKEN_KEY);
    if (!value) {
      router.replace("/");
      return;
    }
    setToken(value);
  }, [router]);

  const load = useCallback(async () => {
    if (!token) return;
    setError("");
    const response = await fetch("/api/ops/overview", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (response.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      router.replace("/");
      return;
    }
    if (!response.ok) {
      setError("加载运维概览失败");
      return;
    }
    setOverview(await response.json());
  }, [token, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runPilot() {
    if (!token) return;
    const response = await fetch("/api/ops/overview", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      setError("Pilot 分析失败");
      return;
    }
    setPilot(await response.json());
  }

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    router.replace("/");
  }

  if (!token) return null;

  return (
    <main className="shell">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end" }}>
        <div>
          <h1 className="brand" style={{ fontSize: "2.4rem" }}>
            Opsilot
          </h1>
          <p className="slogan">不仅仅只是结算</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="secondary" onClick={() => void load()}>
            刷新
          </button>
          <button type="button" className="secondary" onClick={logout}>
            退出
          </button>
        </div>
      </div>

      {error ? <p className="danger">{error}</p> : null}

      <div className="row two">
        <section className="panel">
          <h2>钱包 / Gas</h2>
          {overview ? (
            <>
              <p className="muted">{overview.network}</p>
              <p style={{ wordBreak: "break-all" }}>{overview.wallet.address}</p>
              <p>
                余额 {overview.wallet.gasBalanceAvax.toFixed(4)} AVAX
                {overview.wallet.low ? <span className="danger"> · 低于阈值</span> : null}
              </p>
              <p className="muted">阈值 {overview.wallet.alertThresholdAvax} AVAX</p>
              <p>RPC：{overview.rpcOk ? "正常" : <span className="danger">异常</span>}</p>
            </>
          ) : (
            <p className="muted">加载中…</p>
          )}
        </section>

        <section className="panel">
          <h2>Pilot</h2>
          <p className="muted">根据 gas / pending / 成功率给出下一步建议（只读）</p>
          <button type="button" onClick={() => void runPilot()}>
            运行分析
          </button>
          {pilot ? (
            <>
              <p style={{ marginTop: 14 }}>{pilot.summary}</p>
              {pilot.priorities.map((item) => (
                <div key={`${item.topic}-${item.evidence}`} className={`priority ${item.severity}`}>
                  <strong>
                    [{item.severity}] {item.topic}
                  </strong>
                  <div>{item.evidence}</div>
                  <div className="muted">{item.recommendation}</div>
                </div>
              ))}
            </>
          ) : null}
        </section>
      </div>

      <section className="panel">
        <h2>最近结算</h2>
        <table className="table">
          <thead>
            <tr>
              <th>状态</th>
              <th>金额 / 资产</th>
              <th>交易</th>
              <th>更新时间</th>
            </tr>
          </thead>
          <tbody>
            {(overview?.settlements ?? []).map((row) => (
              <tr key={row.payment_key}>
                <td>
                  <span className={`pill ${row.status}`}>{row.status}</span>
                </td>
                <td>
                  {row.amount}
                  <div className="muted" style={{ wordBreak: "break-all" }}>
                    {row.asset}
                  </div>
                </td>
                <td style={{ wordBreak: "break-all" }}>
                  {row.tx_hash ?? "—"}
                  {row.error_reason ? <div className="muted">{row.error_reason}</div> : null}
                </td>
                <td>{row.updated_at}</td>
              </tr>
            ))}
            {overview && overview.settlements.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  暂无结算记录
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
