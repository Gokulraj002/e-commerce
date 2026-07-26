# GitHub Actions — Elite NonVeg

Two workflows live here:

| File          | Trigger                                                    | Purpose                                    |
| ------------- | ---------------------------------------------------------- | ------------------------------------------ |
| `ci.yml`      | `pull_request` → main, `push` to non-main, manual dispatch | Lint, typecheck, build, backend tests      |
| `deploy.yml`  | `push` → main, manual dispatch                             | SSH into the production host and deploy   |

---

## Required repository secrets

Both workflows read from repository (and/or environment) secrets. Set them in
**Settings → Secrets and variables → Actions**.

### For `deploy.yml`

| Secret         | Purpose                                                                         |
| -------------- | ------------------------------------------------------------------------------- |
| `DEPLOY_HOST`  | Hostname or IP of the production server (e.g. `prod.elite-nonveg.example.com`). |
| `DEPLOY_USER`  | SSH user with permission to run `deployment/scripts/deploy.sh` (e.g. `deploy`). |
| `DEPLOY_KEY`   | The **private** SSH key (PEM/OpenSSH format) whose public half is authorized on the host. Generate a dedicated key for CI — do not reuse a personal one. |

The corresponding **public** key must be appended to
`/home/<DEPLOY_USER>/.ssh/authorized_keys` on the server.

An optional workflow input `ref` (SHA / branch / tag) overrides the default
`github.sha` — useful for redeploying an older commit.

### For `ci.yml`

No repository secrets required. Postgres and Redis service containers use
throwaway credentials scoped to the runner.

---

## Branch protection (recommended)

Set the following on `main` under **Settings → Branches → Branch protection rules**:

- Require a pull request before merging
- Require status checks to pass before merging:
  - `Lint`
  - `Typecheck`
  - `Build (backend)` / `Build (frontend)` / `Build (admin)`
  - `Backend tests`
- Require branches to be up to date before merging

The `deploy.yml` workflow assumes CI has already passed on the PR before merge —
it does not re-run CI on the push to `main`.

---

## Running workflows manually

Both workflows declare `workflow_dispatch`, so either can be triggered on
demand from the **Actions** tab:

1. Open `https://github.com/<owner>/<repo>/actions`.
2. Pick **CI** or **Deploy** in the left sidebar.
3. Click **Run workflow** on the right.
4. For **Deploy**, optionally paste a commit SHA / branch / tag into the `ref`
   input to deploy something other than the current `main` HEAD.

Or from the CLI (`gh` required):

```bash
# Re-run CI on the current branch
gh workflow run ci.yml

# Deploy a specific commit
gh workflow run deploy.yml -f ref=abc1234
```

---

## Rollback

Rollbacks are **not** automated. If a deploy fails or a bad build reaches
production, SSH to the host and run:

```bash
cd /home/deploy/elite
bash deployment/scripts/rollback.sh
```

See the failure annotation on any failed deploy run for a reminder.

---

## Pinned action versions

All third-party actions are pinned to explicit version tags:

- `actions/checkout@v4`
- `actions/setup-node@v4`
- `actions/github-script@v7`
- `appleboy/ssh-action@v1.0.3`

When bumping, update **both** workflow files and this README together.
Dependabot (`.github/dependabot.yml`) will open PRs weekly.
