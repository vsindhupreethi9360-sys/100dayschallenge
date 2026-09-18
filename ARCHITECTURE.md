# Architecture & Future Roadmap

This app is deliberately structured so the features below can be added
**without rewriting what already exists**. Nothing here is implemented
yet — this is the plan for when you're ready.

## The key seam: `js/storage.js`

Every read/write of app data goes through exactly two functions:

```js
await AppStorage.load()        // returns the saved state, or null
await AppStorage.save(state)   // persists the given state
```

`state.js`, `ui.js`, and everything else never touch `localStorage`
directly — they only ever call `AppStorage.load()` / `AppStorage.save()`.
That means swapping the backing store is a one-file change.

## Adding user accounts + a cloud database (e.g. Supabase)

1. Add a `js/auth.js` with sign-up/sign-in/sign-out calling your auth
   provider's SDK (Supabase Auth, Auth0, Firebase Auth, etc).
2. Replace the body of `Storage.load()` / `Storage.save()` in
   `js/storage.js` with calls to your database, scoped to the signed-in
   user's id — e.g. a `challenges` table keyed by `user_id`, storing
   the same JSON blob this app already produces (see `state.js`'s
   `defaultState()` for the exact shape), or normalized into proper
   tables if you'd rather query pieces of it server-side.
3. Gate `main.js`'s bootstrap on being signed in — show a login screen
   first, then call `loadState()` once authenticated.
4. Everything in `ui.js` keeps working unchanged, because it only
   ever calls `Actions.*` (which mutate in-memory `state` and call
   `persist()`) — it has no idea whether `persist()` ends up writing
   to localStorage or to a network request.

## Multi-user support

Once each user's state is scoped by `user_id` in your database (step 2
above), multi-user support falls out of the auth integration — there's
no per-user logic to add in this codebase, since it was already
designed around a single `state` object per session.

## Subscription / payments / premium features

1. Add a `plan` field to the user's account row in your database
   (e.g. `free` / `premium`), set via your payment provider's webhook
   (Stripe, Paddle, etc.) after checkout.
2. Gate specific features by checking that field before calling the
   relevant `Actions.*` function or rendering the relevant UI — e.g.
   limit free accounts to 1 active challenge (`state.pastChallenges`
   already tracks challenge history, so "how many challenges has this
   user run" is already available), or a maximum number of categories.
3. Add a `/pricing` or in-app upgrade prompt page; this is regular
   frontend work independent of the state/storage architecture above.

## Why this design makes that straightforward

- **No global fixed categories** — categories are data
  (`state.categories`, `state.categoryOrder`), so a database schema
  for them is just a `categories` table with a foreign key to
  `user_id`. Same for `tasks`, keyed similarly.
- **Task version history is already relational-friendly** — each
  task's `versions[]` array (with `fromDay`, and the fields that
  changed) maps cleanly to a `task_versions` table if you later want
  to query history server-side instead of shipping the whole blob to
  the client.
- **All mutations flow through `Actions.*`** in `state.js`, and all
  persistence flows through `Storage.*` — these two seams are where
  100% of a backend migration happens. `ui.js` does not need to change.
