import { getVaultGuardRepository } from '../packages/database/repositories';

async function main() {
  const repo = await getVaultGuardRepository();
  console.log(`Seeded VaultGuard repository with ${repo.getInvoices().length} invoices and ${repo.contract.get_all_vendors().length} vendors.`);
}

main();
