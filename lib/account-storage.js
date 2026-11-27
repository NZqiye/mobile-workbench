export const activeAccountStorageKey = "qiyeworkbench:activeAccount";
let accountId;

export function activeAccountId() {
  if (typeof window === "undefined") return "personal-workbench";
  if (!accountId) accountId = localStorage.getItem(activeAccountStorageKey) === "test-workbench" ? "test-workbench" : "personal-workbench";
  return accountId;
}

export function accountStorageKey(name) {
  return `qiyeworkbench:${activeAccountId() === "test-workbench" ? "user:" : ""}${name}`;
}

export function selectAccountStorage(id) {
  if (!["personal-workbench", "test-workbench"].includes(id)) throw new Error("账号不存在");
  const changed = activeAccountId() !== id;
  localStorage.setItem(activeAccountStorageKey, id);
  return changed;
}
