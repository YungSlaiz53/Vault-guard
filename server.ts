import express, { NextFunction, Request, Response } from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { getVaultGuardRepository } from './packages/database/repositories';
import { getActivePaymentMode, getSupportedIntentsAssets } from './packages/intents/client';
import {
  runAllAdversarialGates,
  runGate1CustodyAttacks,
  runGate2AttestationAttacks,
  runGate3SettlementAttacks,
} from './packages/policy-engine/adversarial-runner';
import {
  ErrorCode,
  parseDecimalToBaseUnits,
  PolicyUpdateSchema,
  SettlementExecuteRequestSchema,
  SettlementQuoteRequestSchema,
  VaultGuardError,
  VendorCreateSchema,
  VendorUpdateSchema,
} from './packages/shared';

const app = express();
app.use(express.json({ limit: '5mb' }));

// Simple in-memory rate limiter per IP
const rateLimitWindowMs = 60_000;
const maxRequestsPerMinute = 300;
const requestCounts = new Map<string, { count: number; resetAt: number }>();

app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || '127.0.0.1';
  const now = Date.now();
  const entry = requestCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + rateLimitWindowMs });
  } else {
    entry.count++;
    if (entry.count > maxRequestsPerMinute) {
      res.status(429).json({
        error: 'ERR_RATE_LIMITED',
        message: 'Too many requests, please retry shortly.',
      });
      return;
    }
  }
  next();
});

function getCallerAccount(req: Request, defaultAccount = 'admin.vaultguard.testnet'): string {
  const headerAccount = req.header('x-near-account-id');
  return headerAccount && headerAccount.trim().length > 0 ? headerAccount.trim() : defaultAccount;
}

// Health & System Overview
app.get('/api/health', async (_req: Request, res: Response) => {
  const repo = await getVaultGuardRepository();
  const policy = repo.contract.get_policy();
  res.json({
    status: 'ok',
    service: 'VaultGuard Treasury Security Engine',
    nearNetwork: process.env.NEAR_NETWORK || 'testnet',
    paymentMode: getActivePaymentMode(),
    policyContractId: policy.policyContractAccount,
    treasuryCustodyAccountId: policy.treasuryCustodyAccount,
    emergencyPaused: policy.emergencyPaused,
    policyVersion: policy.policyVersion,
    timestamp: new Date().toISOString(),
  });
});

// Invoices Endpoints
app.get('/api/invoices', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = await getVaultGuardRepository();
    res.json({ invoices: repo.getInvoices() });
  } catch (err) {
    next(err);
  }
});

app.get('/api/invoices/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = await getVaultGuardRepository();
    const invoice = repo.getInvoice(req.params.id);
    if (!invoice) {
      throw new VaultGuardError(ErrorCode.ERR_INVALID_INVOICE, `Invoice "${req.params.id}" not found`, 404);
    }
    res.json({ invoice });
  } catch (err) {
    next(err);
  }
});

app.post('/api/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = await getVaultGuardRepository();
    const invoice = repo.createInvoice(req.body);
    res.status(201).json({ invoice });
  } catch (err) {
    next(err);
  }
});

app.post('/api/invoices/:id/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = await getVaultGuardRepository();
    const simulateAiFailure = Boolean(req.body?.simulateAiFailureToDetectInjection);
    const invoice = await repo.verifyInvoice(req.params.id, {
      simulateAiFailureToDetectInjection: simulateAiFailure,
    });
    res.json({ invoice });
  } catch (err) {
    next(err);
  }
});

app.post('/api/invoices/:id/authorize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = await getVaultGuardRepository();
    const caller = getCallerAccount(req, 'ai-executor.vaultguard.testnet');
    const invoice = await repo.authorizeInvoice(req.params.id, caller);
    res.json({ invoice });
  } catch (err) {
    next(err);
  }
});

// Vendors Endpoints
app.get('/api/vendors', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = await getVaultGuardRepository();
    res.json({ vendors: repo.contract.get_all_vendors() });
  } catch (err) {
    next(err);
  }
});

app.post('/api/vendors', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = await getVaultGuardRepository();
    const caller = getCallerAccount(req, 'admin.vaultguard.testnet');
    const parsed = VendorCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new VaultGuardError(
        ErrorCode.ERR_INVALID_INVOICE,
        parsed.error.issues.map((i) => i.message).join('; ')
      );
    }
    const now = new Date().toISOString();
    const created = repo.contract.register_vendor(caller, {
      ...parsed.data,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
    res.status(201).json({ vendor: created });
  } catch (err) {
    next(err);
  }
});

app.patch('/api/vendors/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = await getVaultGuardRepository();
    const caller = getCallerAccount(req, 'admin.vaultguard.testnet');
    const parsed = VendorUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new VaultGuardError(
        ErrorCode.ERR_INVALID_INVOICE,
        parsed.error.issues.map((i) => i.message).join('; ')
      );
    }
    const updated = repo.contract.update_vendor(caller, req.params.id, parsed.data);
    res.json({ vendor: updated });
  } catch (err) {
    next(err);
  }
});

// Policies & Access Key Endpoints
app.get('/api/policies', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = await getVaultGuardRepository();
    res.json({
      policy: repo.contract.get_policy(),
      spendingUsage: repo.contract.get_spending_usage(),
      agentFunctionCallKey: repo.contract.getAgentFunctionCallKey(),
      users: repo.getUsers(),
    });
  } catch (err) {
    next(err);
  }
});

app.patch('/api/policies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = await getVaultGuardRepository();
    const caller = getCallerAccount(req, 'admin.vaultguard.testnet');
    const parsed = PolicyUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new VaultGuardError(
        ErrorCode.ERR_INVALID_INVOICE,
        parsed.error.issues.map((i) => i.message).join('; ')
      );
    }

    const data = parsed.data;
    if (data.emergencyPaused !== undefined) {
      if (data.emergencyPaused) {
        repo.contract.emergency_pause(caller);
        repo.recordSecurityEvent({
          category: 'EMERGENCY_PAUSE',
          severity: 'CRITICAL',
          errorCode: ErrorCode.ERR_EMERGENCY_PAUSED,
          actor: caller,
          description: 'Treasury Administrator activated Emergency Pause on policy contract.',
        });
      } else {
        repo.contract.resume_operations(caller);
      }
    }

    const updates: Record<string, unknown> = {};
    if (data.maxInvoiceAmountDecimal) {
      updates.maxInvoiceAmountBaseUnits = parseDecimalToBaseUnits(data.maxInvoiceAmountDecimal, 6);
    }
    if (data.dailySpendLimitDecimal) {
      updates.dailySpendLimitBaseUnits = parseDecimalToBaseUnits(data.dailySpendLimitDecimal, 6);
    }
    if (data.approvedChains) updates.approvedChains = data.approvedChains;
    if (data.approvedTokens) updates.approvedTokens = data.approvedTokens;
    if (data.maxSlippageBps !== undefined) updates.maxSlippageBps = data.maxSlippageBps;

    if (Object.keys(updates).length > 0) {
      repo.contract.set_policy(caller, updates);
    }

    res.json({
      policy: repo.contract.get_policy(),
      spendingUsage: repo.contract.get_spending_usage(),
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/keys/agent/toggle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = await getVaultGuardRepository();
    const caller = getCallerAccount(req, 'admin.vaultguard.testnet');
    const current = repo.contract.getAgentFunctionCallKey();
    const updated = current.revoked
      ? repo.contract.restoreAgentFunctionCallKey(caller)
      : repo.contract.revokeAgentFunctionCallKey(caller);
    res.json({ agentFunctionCallKey: updated });
  } catch (err) {
    next(err);
  }
});

// Treasury Endpoints
app.get('/api/treasury', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = await getVaultGuardRepository();
    const policy = repo.contract.get_policy();
    res.json({
      treasuryCustodyAccount: policy.treasuryCustodyAccount,
      policyContractAccount: policy.policyContractAccount,
      treasuryAdminAccount: policy.treasuryAdminAccount,
      agentExecutorAccount: policy.authorizedAgentAccounts[0],
      balancesBaseUnits: repo.contract.get_treasury_balances(),
      spendingUsage: repo.contract.get_spending_usage(),
      reservations: repo.contract.get_all_reservations(),
      agentFunctionCallKey: repo.contract.getAgentFunctionCallKey(),
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/treasury/activity', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = await getVaultGuardRepository();
    res.json({
      reservations: repo.contract.get_all_reservations(),
      settlements: repo.settlementOrchestrator.getAllSettlements(),
      auditEvents: repo.getAuditEvents().slice(0, 25),
    });
  } catch (err) {
    next(err);
  }
});

app.post(
  '/api/treasury/reservations/:id/release',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const repo = await getVaultGuardRepository();
      const caller = getCallerAccount(req, 'admin.vaultguard.testnet');
      const released = repo.contract.release_reservation({
        callerAccountId: caller,
        reservationId: req.params.id,
        reason: req.body?.reason || 'Manual administrator release',
      });
      res.json({ reservation: released });
    } catch (err) {
      next(err);
    }
  }
);

// Settlements (NEAR Intents 1Click) Endpoints
app.get('/api/settlements', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = await getVaultGuardRepository();
    res.json({
      paymentMode: getActivePaymentMode(),
      supportedAssets: getSupportedIntentsAssets(),
      settlements: repo.settlementOrchestrator.getAllSettlements(),
      reservations: repo.contract.get_all_reservations(),
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/settlements/quote', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = await getVaultGuardRepository();
    const parsed = SettlementQuoteRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new VaultGuardError(
        ErrorCode.ERR_INVALID_INVOICE,
        parsed.error.issues.map((i) => i.message).join('; ')
      );
    }
    const quote = repo.createSettlementQuote(parsed.data.invoiceId, parsed.data.slippageBps ?? 20);
    res.json({ quote });
  } catch (err) {
    next(err);
  }
});

app.post('/api/settlements/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = await getVaultGuardRepository();
    const caller = getCallerAccount(req, 'ai-executor.vaultguard.testnet');
    const parsed = SettlementExecuteRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new VaultGuardError(
        ErrorCode.ERR_INVALID_INVOICE,
        parsed.error.issues.map((i) => i.message).join('; ')
      );
    }
    const settlement = repo.executeInvoiceSettlement({
      invoiceId: parsed.data.invoiceId,
      quoteId: parsed.data.quoteId,
      idempotencyKey: parsed.data.idempotencyKey,
      callerAccountId: caller,
      humanConfirmationSignature: parsed.data.humanConfirmationSignature,
    });
    res.json({ settlement });
  } catch (err) {
    next(err);
  }
});

app.get('/api/settlements/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = await getVaultGuardRepository();
    const settlement = repo.settlementOrchestrator.getSettlement(req.params.id);
    if (!settlement) {
      throw new VaultGuardError(
        ErrorCode.ERR_SETTLEMENT_NOT_CONFIRMED,
        `Settlement "${req.params.id}" not found`,
        404
      );
    }
    res.json({ settlement });
  } catch (err) {
    next(err);
  }
});

// Audit & Security Center Endpoints
app.get('/api/audit', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = await getVaultGuardRepository();
    res.json({ auditEvents: repo.getAuditEvents() });
  } catch (err) {
    next(err);
  }
});

app.get('/api/security/events', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = await getVaultGuardRepository();
    res.json({
      securityEvents: repo.getSecurityEvents(),
      gateSummary: runAllAdversarialGates(),
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/security/run-gate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gate = req.body?.gate || 'ALL';
    if (gate === 'GATE_1_CUSTODY') {
      const results = runGate1CustodyAttacks();
      res.json({ gate, results });
      return;
    }
    if (gate === 'GATE_2_ATTESTATION') {
      const results = runGate2AttestationAttacks();
      res.json({ gate, results });
      return;
    }
    if (gate === 'GATE_3_SETTLEMENT') {
      const results = runGate3SettlementAttacks();
      res.json({ gate, results });
      return;
    }
    const summary = runAllAdversarialGates();
    res.json({
      gate: 'ALL',
      results: [...summary.gate1, ...summary.gate2, ...summary.gate3],
      summary,
    });
  } catch (err) {
    next(err);
  }
});

// Structured Error Handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof VaultGuardError) {
    res.status(err.statusCode).json(err.toJSON());
    return;
  }
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({
    error: ErrorCode.ERR_INVALID_INVOICE,
    message,
  });
});

async function startServer() {
  const port = 3000;
  await getVaultGuardRepository();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`VaultGuard Server listening on http://localhost:${port}`);
  });
}

startServer();
