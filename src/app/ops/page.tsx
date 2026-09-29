"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const TOKEN_KEY = "opsilot_ops_token";

type Overview = {
  network: string;
  nativeSymbol: string;
  wallet: {
    address: string;
    gasBalance: number;
    alertThreshold: number;
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

type ExplorerTx = {
  hash: string;
  network: string;
  nativeSymbol: string;
  externalUrl: string;
  status: string;
  blockNumber: string | null;
  timestamp: string | null;
  from: string | null;
  to: string | null;
  valueNative: string | null;
  gasUsed: string | null;
  effectiveGasPriceGwei: string | null;
  transfers: Array<{
    token: string;
    tokenLabel: string;
    from: string;
    to: string;
    amount: string;
  }>;
};

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

export default function OpsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [pilot, setPilot] = useState<PilotReport | null>(null);
  const [error, setError] = useState("");
  const [explorerHash, setExplorerHash] = useState<string | null>(null);
  const [explorer, setExplorer] = useState<ExplorerTx | null>(null);
  const [explorerLoading, setExplorerLoading] = useState(false);
  const [explorerError, setExplorerError] = useState("");

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

  useEffect(() => {
    if (!token || !explorerHash) {
      setExplorer(null);
      setExplorerError("");
      return;
    }
    let cancelled = false;
    setExplorerLoading(true);
    setExplorerError("");
    setExplorer(null);
    void (async () => {
      const response = await fetch(`/api/ops/explorer/${explorerHash}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (cancelled) return;
      if (response.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        router.replace("/");
        return;
      }
      if (!response.ok) {
        setExplorerError("拉取链上交易失败");
        setExplorerLoading(false);
        return;
      }
      setExplorer(await response.json());
      setExplorerLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, explorerHash, router]);

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
                余额 {overview.wallet.gasBalance.toFixed(4)} {overview.nativeSymbol}
                {overview.wallet.low ? <span className="danger"> · 低于阈值</span> : null}
              </p>
              <p className="muted">
                阈值 {overview.wallet.alertThreshold} {overview.nativeSymbol}
              </p>
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
                  {row.tx_hash ? (
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => setExplorerHash(row.tx_hash)}
                      title={row.tx_hash}
                    >
                      {shortHash(row.tx_hash)}
                    </button>
                  ) : (
                    "—"
                  )}
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

      {explorerHash ? (
        <div className="drawer-root" role="dialog" aria-modal="true" aria-label="链上浏览器">
          <button type="button" className="drawer-backdrop" aria-label="关闭" onClick={() => setExplorerHash(null)} />
          <aside className="drawer">
            <div className="drawer-head">
              <div>
                <h2 style={{ margin: 0 }}>链上浏览器</h2>
                <p className="muted" style={{ margin: "6px 0 0" }}>
                  {overview?.network ?? "configured network"} · 内嵌交易视图
                </p>
              </div>
              <button type="button" className="secondary" onClick={() => setExplorerHash(null)}>
                关闭
              </button>
            </div>

            <p className="mono" style={{ wordBreak: "break-all" }}>
              {explorerHash}
            </p>

            {explorerLoading ? <p className="muted">正在从节点读取交易…</p> : null}
            {explorerError ? <p className="danger">{explorerError}</p> : null}

            {explorer ? (
              <div className="explorer-grid">
                <div>
                  <div className="muted">状态</div>
                  <div>
                    <span className={`pill ${explorer.status === "success" ? "success" : explorer.status === "pending" ? "pending" : "failed"}`}>
                      {explorer.status}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="muted">区块</div>
                  <div>{explorer.blockNumber ?? "—"}</div>
                </div>
                <div>
                  <div className="muted">时间</div>
                  <div>{explorer.timestamp ?? "—"}</div>
                </div>
                <div>
                  <div className="muted">原生金额</div>
                  <div>
                    {explorer.valueNative != null
                      ? `${explorer.valueNative} ${explorer.nativeSymbol}`
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="muted">From</div>
                  <div className="mono" style={{ wordBreak: "break-all" }}>
                    {explorer.from ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="muted">To</div>
                  <div className="mono" style={{ wordBreak: "break-all" }}>
                    {explorer.to ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="muted">Gas used</div>
                  <div>{explorer.gasUsed ?? "—"}</div>
                </div>
                <div>
                  <div className="muted">Gas price</div>
                  <div>{explorer.effectiveGasPriceGwei != null ? `${explorer.effectiveGasPriceGwei} gwei` : "—"}</div>
                </div>
              </div>
            ) : null}

            {explorer && explorer.transfers.length > 0 ? (
              <section style={{ marginTop: 18 }}>
                <h3 style={{ margin: "0 0 8px" }}>Token Transfer</h3>
                {explorer.transfers.map((t, index) => (
                  <div key={`${t.token}-${index}`} className="priority info">
                    <strong>
                      {t.amount} {t.tokenLabel}
                    </strong>
                    <div className="muted mono" style={{ wordBreak: "break-all" }}>
                      {t.from} → {t.to}
                    </div>
                  </div>
                ))}
              </section>
            ) : null}

            <div className="explorer-frame-wrap">
              <div className="drawer-head" style={{ marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>区块浏览器内嵌</h3>
                {explorer?.externalUrl ? (
                  <a className="muted" href={explorer.externalUrl} target="_blank" rel="noreferrer">
                    新窗口打开
                  </a>
                ) : null}
              </div>
              {explorer?.externalUrl ? (
                <iframe
                  className="explorer-frame"
                  title="Block explorer"
                  src={explorer.externalUrl}
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                />
              ) : (
                <p className="muted">等待交易详情…</p>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
