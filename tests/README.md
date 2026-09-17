# tests/

The battery from [EVAL.md](../EVAL.md). What exists so far:

| dir | EVAL § | what it holds |
| --- | --- | --- |
| `render/` | 3 | every visible dial row in every host, screenshotted and held to a baseline; the cross-host parity report |
| `__screenshots__/` | 3 | the baselines, **committed**, cut on linux in CI |

The hosts are the consumers' *built* `dist/`, served by `serve.mjs` at the base path each
deploys to. Locally they are the sibling checkouts (`../font-proofer/dist`, `../ReCal/dist`
— build them first); in CI they are fresh checkouts with this commit in `shared/`.

```
npm run test:render            # compare against the committed baselines
npm run test:render:update     # re-cut them -- deliberate, after an intended change
npx playwright show-report     # the diffs, side by side
```

A run on a Mac compares macOS text rendering against linux baselines and will report
small diffs. That is information, not a verdict: read the report, and only re-cut
baselines from CI (`workflow_dispatch` on Consumers, then download the artifact).

Cross-host is **numbers, not pixels**. The hosts show different labels and values, so two
screenshots of `size` cannot be equal; the row height, label size and weight, bar height
and field size can. `rows.spec.ts` collects those per host into `test-results/parity/`
and the last test prints every disagreement. It never fails: a host overriding a
primitive is allowed by the layer contract, and the report exists to show where.
