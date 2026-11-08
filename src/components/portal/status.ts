export function statusTone(label: string) {
  const value = label.toLowerCase()
  if (["no-show", "no show", "cancelled", "rejected", "failed"].includes(value))
    return "danger"
  if (
    [
      "needs review",
      "manual review",
      "follow-up needed",
      "incomplete",
      "proof submitted",
      "wire pending",
      "unassigned",
    ].includes(value)
  )
    return "attention"
  if (
    [
      "qualified",
      "priority qualified",
      "confirmed",
      "completed",
      "attended",
      "wire received",
      "applied",
    ].includes(value)
  )
    return "success"
  if (["scheduled", "call booked", "up next"].includes(value)) return "info"
  if (["registered", "webinar"].includes(value)) return "source"
  return "neutral"
}
