export function nativeReminderTasks(plans) {
  return plans.filter(plan => plan.status !== "已完成" && plan.reminderAt && plan.id && plan.title).map(plan => {
    const value = String(plan.reminderAt);
    const at = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}+08:00`);
    return { id: String(plan.id), title: String(plan.title).slice(0, 500), at };
  }).filter(task => Number.isFinite(task.at) && task.at > 0);
}
