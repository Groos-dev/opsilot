# Opsilot

**Ops + Pilot · 不仅仅只是结算 / More than settlement**

开箱即用的 x402 结算服务：进程内 `@x402/core` + `@x402/evm` 完成 `/supported` `/verify` `/settle`，并带幂等账本、串行结算队列、pending 对账、gas 观测，以及只读运维副驾驶 **Pilot**（Next.js + React 面板）。

## 快速开始

```bash
cp .env.example .env
# 填写 SETTLEMENT_PRIVATE_KEY、OPS_API_TOKEN、RPC_URL
npm install
npm run dev
```

- 运维面板：http://127.0.0.1:4030/  
- 协议基址（给业务 `facilitatorUrl`）：http://127.0.0.1:4030  
- 健康检查：`GET /health`  
- 指标：`GET /metrics`

Docker：

```bash
cd deploy
docker compose up --build
```

## 设计要点

- 成功结算写入 SQLite；相同付款凭证再次 settle 直接复用结果，避免重复上链耗 gas  
- pending 需先对账，禁止业务侧盲目让用户重签导致双扣  
- Pilot 只读分析，不自动转账  

规格：[docs/specs/2026-09-29-opsilot-design.md](docs/specs/2026-09-29-opsilot-design.md)
