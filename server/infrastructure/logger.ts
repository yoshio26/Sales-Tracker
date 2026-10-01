const sensitivePattern = /(password|token|secret|authorization|cookie)=?[^\s,;]+/gi

function redact(value: string): string {
  return value.replace(sensitivePattern, '$1=[REDACTED]')
}

export function logError(event: string, error: unknown, fields: Record<string, unknown> = {}): void {
  const details = error instanceof Error
    ? { name: error.name, message: redact(error.message), code: 'code' in error ? error.code : undefined }
    : { message: redact(String(error)) }
  console.error(JSON.stringify({ level: 'error', event, ...fields, error: details }))
}