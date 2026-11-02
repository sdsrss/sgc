// Tests run as CI runs them, also when started from a Claude Code session:
// its Bash tool exports CLAUDECODE=1, which turns sgc's file-poll dispatch
// off (insideClaudeCode in src/dispatcher/spawn.ts). The tests of that
// switch set the variable themselves.
delete process.env["CLAUDECODE"]
