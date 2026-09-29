# Opsilot 设计说明

日期：2026-09-29  
产品名：**Opsilot**（Ops + Pilot）  
口号：**不仅仅只是结算** / *More than settlement*  
实现目录：仓库根目录

## 目标

开箱即用的 **x402 结算服务**：对外提供标准 `/supported`、`/verify`、`/settle`；对内用官方 `@x402/core` + `@x402/evm` 完成链上校验与结算；并提供生产向运维能力——幂等账本、串行结算队列、pending 对账、gas 观测、指标，以及只读运维副驾驶 **Pilot**（Next.js + React 面板）。

业务侧继续使用官方 `@x402/express`（或兼容中间件），将 `facilitatorUrl` 指向 Opsilot。本仓库 **不提供** 收款 SDK 或付款客户端。

## 架构

单一长期运行的 Node 进程（`next dev` / `next start`，不要用无状态 serverless 拆散 settle）：

```text
业务资源服务 (@x402/express)
        │  facilitatorUrl → Opsilot
        ▼
┌────────── Opsilot（Next.js）──────────┐
│  React 运维面板（令牌入口 + Pilot）      │
│  Route Handlers：协议 + /api/ops/*     │
│  幂等账本 · 串行队列 · 对账 · 指标      │
│                 │                     │
│                 ▼                     │
│  x402Facilitator + ExactEvmScheme     │
│            SQLite                     │
└─────────────────┬─────────────────────┘
                  ▼
            配置的 EVM 网络（演示默认 Fuji）
```

结算协议能力来自官方 npm 包，不翻译 x402-rs。本仓库增量在运维语义与面板。

## 明确不做

- 自研与 `@x402/express` 同构的收款中间件产品  
- 付款客户端 / 代理预算 SDK  
- 第一期：多实例共享同一热钱包 nonce、自动加速交易、Pilot 自动转账  
- 完整用户账号体系（仅 `OPS_API_TOKEN`）

## 技术选型

| 组件 | 选择 |
|---|---|
| 应用 | Next.js App Router + React + TypeScript |
| 协议 HTTP | Route Handlers；根路径 rewrite 到 `/api/*` |
| 结算核 | `@x402/core` `x402Facilitator` + `@x402/evm` `ExactEvmScheme` |
| 链 | viem |
| 账本 | better-sqlite3 |
| 队列 | 单进程按钱包串行 |
| 指标 | prom-client → `/metrics` |
| 部署 | `deploy/docker-compose.yml` |

## 接口

### 协议（对资源服务，通常无运维鉴权）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/supported` | 支持的 scheme / 网络 |
| POST | `/verify` | 校验付款凭证 |
| POST | `/settle` | 结算（经幂等与队列） |

### 健康与指标

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/health` | 进程、RPC、钱包、supported 概况 |
| GET | `/metrics` | Prometheus 文本 |

### 运维（需 `Authorization: Bearer <OPS_API_TOKEN>`）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/ops/overview` | 钱包 gas、RPC、最近结算流水 |
| POST | `/api/ops/overview` | Pilot 规则分析（只读建议） |
| GET | `/api/ops/settlements` | 结算列表；`?paymentKey=` 查单笔 |
| GET | `/api/ops/reconcile/:txHash` | 按交易哈希对账 |

面板：`/` 令牌入口 → `/ops` 运维面。

## 结算语义

1. 对 `paymentPayload` 规范化哈希得到 `paymentKey`。  
2. 账本已 **success** → 直接返回原结果，不再上链。  
3. 账本 **pending** 且有 `txHash` → 先对账；成功则升格；仍 pending 则返回 `settlement_pending`（禁止业务当作失败后让用户重签）。  
4. 否则进入该结算钱包串行队列，调用 `facilitator.settle`，按结果写入 success / pending / failed。

## 账本字段

`payment_key`、`status`（success|pending|failed）、`tx_hash`、`network`、`asset`、`amount`、`pay_to`、`error_reason`、`created_at`、`updated_at`

## Pilot 输出

```ts
{
  summary: string
  priorities: Array<{
    severity: "critical" | "warning" | "info"
    topic: "gas" | "pending" | "rpc" | "success_rate" | "queue" | "other"
    evidence: string
    recommendation: string
  }>
}
```

默认规则引擎（gas 阈值、pending 数、成功率、RPC）；不自动执行资金操作。

## 配置

见 `.env.example`：

- `PORT`、`NETWORK`、`RPC_URL`  
- `SETTLEMENT_PRIVATE_KEY`  
- `OPS_API_TOKEN`、`DATABASE_PATH`  
- `GAS_ALERT_THRESHOLD_AVAX`、`CONFIRMATION_TIMEOUT_MS`

## 本地运行

```bash
cp .env.example .env   # 填密钥与令牌
npm install
npm run dev            # http://127.0.0.1:4030
```

Docker：`cd deploy && docker compose up --build`
