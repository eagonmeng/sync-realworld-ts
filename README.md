## RealWorld API with Concept Design

Full approach details and engine repo:
[Concept Design and Sync Engine](https://github.com/eagonmeng/sync-blank)

A RealWorld backend that implements the official API spec using Deno,
TypeScript, and MongoDB. The internals are organized around small, independent
modules (“concepts”) and declarative wiring (“synchronizations”) to keep
behavior clear, testable, and easy to evolve. This entire repository is fully
LLM generated from the system prompts found in `.cursor/rules`, which also serve
as documentation for the approach.

### Why this architecture

- **Separation of concerns**: each concept has one responsibility; no
  cross-imports.
- **Declarative wiring**: change behavior by editing synchronizations, not
  business objects.
- **Composability and testing**: concepts and syncs run and test cleanly in
  isolation.

### Directory overview

```
.
├─ concepts/          # domain modules (User, Article, Comment, Tag, …); focused actions + pure queries
├─ syncs/             # declarative wiring of behaviors; see `realworld.ts` for bootstrap/registration
├─ engine/            # minimal synchronization runtime; helpers and `engine/test/` for engine tests
├─ specs/             # human-readable concept specs kept in sync with implementations
|
├─ .cursor/rules      # System prompts and documentation for the approach
├─ example.ts         # compact demo of the engine with toy concepts/syncs
├─ server.ts          # Entrypoint to map RealWorld specific API calls to API concept
├─ RealWorld_spec     # Copy of RealWorld spec, with Postman collection to test all functionality
└─ env.example        # environment configuration template (copy to `.env`)
```

### Quick start

- Copy env and set values:
  ```bash
  cp env.example .env
  # MONGODB_URI, DATABASE_NAME, JWT_SECRET, optional PORT
  ```
- Start the API server:
  ```bash
  deno task dev
  # or
  deno task start
  ```
- Reset database (optional):
  ```bash
  deno task db:reset
  ```

Server runs at `http://localhost:3000`. Endpoints follow the RealWorld spec —
see: [RealWorld specification](https://realworld-docs.netlify.app).

### Architecture goals

This project models the application as small, independent “concepts” with
focused actions and pure query methods. Behavior across concepts is expressed
with declarative “synchronizations” that state when actions connect and how data
flows between them. This yields clear boundaries, granular specification, and
evolvable behavior without entangling modules. For more details, see the repo
linked above.

### License

Copyright (c) MIT CSAIL. All rights reserved.

This project is licensed under the Creative Commons
Attribution-NonCommercial-ShareAlike 4.0 International.

- SPDX: CC-BY-NC-SA-4.0
- https://creativecommons.org/licenses/by-nc-sa/4.0/
