#!/usr/bin/env node
/* `npm run test:render:update` -- but only where the baselines are meant to come from.
   tests/README.md: baselines are cut on linux in CI and committed; a Mac run compares
   against those and reports. A Mac run that RE-CUT them would commit macOS text
   rasterisation as the truth, and the next CI run would go red on every row for a
   reason that is not a change. It happened once (EVAL step 1, "Mac-cut baselines").
   So outside CI this refuses, and says how to get baselines the right way. Forcing is
   possible (WM_FORCE_BASELINES=1), for the day the runner is the thing that is wrong. */
import { spawnSync } from 'node:child_process'

if (!process.env.CI && !process.env.WM_FORCE_BASELINES) {
  console.error(`test:render:update: refusing to re-cut baselines outside CI.

  Baselines are cut on the linux runner and committed (tests/README.md). To re-cut:
    1. push the change; consumers.yml uploads render-<sha> with every actual image
    2. download the artifact and copy the *-actual.png files over tests/__screenshots__/
  or run Consumers by workflow_dispatch and do the same.

  If the runner itself is what is wrong, WM_FORCE_BASELINES=1 npm run test:render:update
  -- and say so in the commit.`)
  process.exit(1)
}
const r = spawnSync('npx', ['playwright', 'test', 'tests/render', '--update-snapshots', ...process.argv.slice(2)], { stdio: 'inherit' })
process.exit(r.status ?? 1)
