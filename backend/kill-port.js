const { execSync } = require('child_process')
const PORT = process.env.PORT || 5000
try {
  const out = execSync(`netstat -ano | findstr ":${PORT} " | findstr "LISTENING"`, { encoding: 'utf8' })
  const pid = out.trim().split(/\s+/).pop()
  if (pid && !isNaN(pid)) {
    execSync(`taskkill /f /pid ${pid}`, { stdio: 'ignore' })
    console.log(`[kill-port] Đã giải phóng port ${PORT} (PID ${pid})`)
  }
} catch {
  // Port trống, không cần làm gì
}
