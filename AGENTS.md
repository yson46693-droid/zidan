# AGENTS.md

## Cursor Cloud specific instructions

### Overview
This is an Arabic RTL phone repair shop management PWA ("ALAA ZIDAN - APP"). Stack: PHP 8.x + MariaDB + vanilla HTML/CSS/JS. No package managers (no npm, composer, etc.).

### Required services
| Service | How to start |
|---------|-------------|
| MariaDB | `sudo mysqld_safe &` (wait ~3s for readiness) |
| PHP dev server | `php -S 0.0.0.0:8000 router.php` from repo root |

### Database setup
- The `.env` file at repo root provides DB credentials (read by `api/database.php`).
- Schema tables are auto-created by PHP endpoints on first access (`CREATE TABLE IF NOT EXISTS`).
- Seed data for phone brands is in `brsql.sql`; import with `mysql -u root <db_name> < brsql.sql`.
- To create an admin user, insert into `users` table with `password_hash('...', PASSWORD_DEFAULT)` hashed password.

### Dev server
Run from repo root:
```
php -S 0.0.0.0:8000 router.php
```
The `router.php` handles static file MIME types, service worker, and API routing (`.php` extension optional for `/api/*` routes).

### Key gotchas
- The app uses `CookieSessionHandler` (sessions stored in client cookies, not on server files), so no session file path configuration is needed.
- `api/config.php` is the shared bootstrap: it starts sessions, sets CORS, includes `database.php` and `api-security.php`. All API endpoints `require_once 'config.php'`.
- Many tables are lazily created via `CREATE TABLE IF NOT EXISTS` in individual API files, not from a single migration.
- Logs go to `logs/php_errors.log`; ensure the `logs/` directory exists.
- The `data/` and `backups/` directories must also exist for backup functionality.

### Testing
There are no automated test suites in this codebase. Verify changes by running the PHP dev server and testing API endpoints manually via `curl` or browser.

### Lint
No linter is configured. PHP syntax can be checked with `php -l <file>`.
