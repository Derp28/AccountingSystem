import { getAuthStatus } from "./auth.js";
import { listAccounts } from "./accounts.js";
import { listEntries } from "./entries.js";
import { getDashboard, getTrialBalance } from "./reports.js";
import { getProfile, getWorkspace } from "./setup.js";

export function getBootstrap(db, auth = null) {
  const authStatus = getAuthStatus(db, auth);
  if (!authStatus.authenticated || !auth?.ledger) {
    return { auth: authStatus };
  }

  const ledgerId = auth.ledger.id;
  return {
    auth: authStatus,
    profile: getProfile(db, auth.user.id),
    workspace: getWorkspace(db, ledgerId),
    accounts: listAccounts(db, ledgerId),
    entries: listEntries(db, ledgerId),
    dashboard: getDashboard(db, ledgerId),
    trialBalance: getTrialBalance(db, ledgerId, { basis: "adjusted" }),
  };
}
