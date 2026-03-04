# SECURITY BASELINE
- No plaintext passwords (bcrypt)
- JWT secrets stored in .env (not in code)
- Audit logs are PII-safe (do not log full request bodies)
- pip-audit + bandit in CI
