import { listAccounts } from "./accounts.js";
import { listEntries } from "./entries.js";
import { getDashboard, getTrialBalance } from "./reports.js";
import { getProfile, getWorkspace } from "./setup.js";

export function getBootstrap(db) {
  return {
    profile: getProfile(db),
    workspace: getWorkspace(db),
    accounts: listAccounts(db),
    entries: listEntries(db),
    dashboard: getDashboard(db),
    trialBalance: getTrialBalance(db),
  };
}
