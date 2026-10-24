# Indocable ERP (automatic-octo-guide)

## Default Rules (keep until this project is hosted, then delete this section)

Set by the owner on 2026-10-24. These five rules apply to every feature Claude builds in
this project. Claude reads this section at the start of every session.
They run whenever a feature is added, changed or removed, in a new or an old project. They
are not part of the default end-of-session routine ("run default"), which stays memory and purge only.

### Rule 1: Unit testing
- After every feature, or every change to one, write unit tests for the code just written.
- A unit test checks one small piece on its own: one function, one component, one rule.
- Run the whole test suite, not only the new tests, before calling anything done.
- If a test finds a glitch, fix it and say what it was. If nothing breaks, say so in one line.
- Old code with no tests gets tests the next time it is touched.

### Rule 2: Integration testing
- An integration test checks that pieces built separately work together: a form and the
  server that receives it, the server and its database, a page and the API it calls.
- Run them once a feature is joined to the rest of the project, not only when it works alone.
- Add them step by step, one connection at a time. Testing everything together in one go
  (the "big bang" way) makes it hard to tell which piece failed.
- Test the real connection where possible (real local database, real local server). Fake
  only what lives outside the project: payment gateways, email, third-party APIs.
- Keep the balance: many small unit tests, fewer integration tests, a handful of full
  end-to-end browser tests.

### Rule 3: Test-driven development (TDD)
- Write the test first, before the feature's code, and watch it fail (red).
- Write the least code that makes it pass (green).
- Tidy the code while the tests keep passing (refactor).
- Repeat for the next small behaviour. A feature is done only when its tests came first
  and pass.
- A quick throwaway prototype may skip this only on the owner's word, and gets its tests
  before it is called finished.

### Rule 4: Break your own work (security inspection)
- In a session where features were added, changed or removed (at most once a day), Claude
  acts as a senior security inspector and tries to break everything built since the last
  inspection.
- Look for: missing input checks, injection (XSS, SQL), secrets or keys in the code, data
  that could leak out of the project, weak login or access rules, unsafe dependencies
  (`npm audit`, `pip-audit`), crashes on bad input, missing error handling, missing tests,
  gaps against what the client asked for.
- Report in points only, no paragraphs:
  - **Done:** what works and was checked
  - **Missing:** what is not there yet
  - **Bugs:** what breaks, and how to make it break
  - **Gaps / risks:** what could go wrong later, each marked High / Medium / Low
- Fix nothing until the owner approves. Then take the points one at a time, explain each in
  plain words (the owner is learning), and fix them together.

### Rule 5: Load test with 1,000+ simulated users
- After a major feature, simulate at least 1,000 users at once (stretch: 1,500) on a local
  copy of the project.
- Measure: how fast pages and APIs answer (typical, and the slowest 5%), how many requests
  fail, where it first slows down or breaks, memory and CPU use.
- Run it only against localhost or a test server the owner owns. Never against someone
  else's site or a paid third-party API: that is an attack on them, and it costs money.
- A local run shows how the code behaves. Real hosting numbers need a run on the hosting
  itself, with the owner's approval.
- Choose the load tool per project (k6, autocannon or Locust are the usual picks) and write
  why in the project's decisions log before adding it.
- Report in points only, same shape as Rule 4. Discuss and fix each point together after
  the owner approves.
