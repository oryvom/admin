const dateTime = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

const dateOnly = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeZone: "Asia/Kolkata",
});

export function formatDateTime(value: Date | null): string {
  if (!value) {
    return "Never";
  }
  return dateTime.format(value);
}

export function formatDate(value: Date): string {
  return dateOnly.format(value);
}
